export type CommandResult = { text: string; isError: boolean; image?: string };
export type { CdpRemoteObject } from '@/components/Console/cdpToSerialized';
import type { CdpRemoteObject } from '@/components/Console/cdpToSerialized';
import { loadSettings } from './settings';
import { ensurePermissions, DOWNLOAD_PERMISSIONS } from './permissions';
import { startVideo, stopVideo } from './video-recorder';
export type ConsoleCommandResult = { cdpResult: CdpRemoteObject } | { text: string; image?: string; video?: string; duration?: number; size?: number; trace?: boolean; traceSize?: number };

type CdpResult = { type?: string; value?: unknown; description?: string; objectId?: string };

/** Video / tracing control messages handled by the service worker rather than evaluated as JS. */
const CAPTURE_COMMANDS: Record<string, string> = {
  'video-start': 'Video recording started',
  'video-stop': 'Video recording stopped',
  'tracing-start': 'Tracing started',
  'tracing-stop': 'Tracing stopped',
};

/** Optional permissions a capture command needs; requested on first use. */
async function captureAllowed(cmdName: string): Promise<boolean> {
  if (cmdName === 'tracing-stop') return ensurePermissions(DOWNLOAD_PERMISSIONS);
  return true;
}

async function evalWithTimeout(expr: string): Promise<{ result?: CdpRemoteObject }> {
  const [{ swDebugEval }, { commandTimeout }] = await Promise.all([
    import('@/lib/sw-debugger'),
    loadSettings(),
  ]);
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    swDebugEval(expr) as Promise<{ result?: CdpRemoteObject }>,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Command timed out after ${commandTimeout / 1000}s`)), commandTimeout);
    }),
  ]).finally(() => clearTimeout(timer!));
}

function parseImage(val: string): string | undefined {
  try {
    const obj = JSON.parse(val);
    if (obj && typeof obj === 'object' && '__image' in obj) {
      const img = obj as { mimeType: string; __image: string };
      return `data:${img.mimeType};base64,${img.__image}`;
    }
  } catch { /* not JSON — treat as plain text */ }
  return undefined;
}

/** Evaluate a JavaScript expression (page, context, expect in scope) and format the result as text. */
export async function executeCommand(command: string): Promise<CommandResult> {
  const cmdName = command.trim().toLowerCase();
  if (cmdName in CAPTURE_COMMANDS) {
    if (!await captureAllowed(cmdName)) return { text: 'Permission not granted', isError: true };
    const r = await chrome.runtime.sendMessage({ type: cmdName });
    if (!r?.ok) return { text: r?.error || 'Failed', isError: true };
    return { text: r.text || CAPTURE_COMMANDS[cmdName], isError: false };
  }

  const { swCallFunctionOn } = await import('@/lib/sw-debugger');

  async function formatResult(r: CdpResult | undefined): Promise<CommandResult> {
    if (!r || r.type === 'undefined') return { text: 'Done', isError: false };
    if (r.type === 'string') {
      const val = r.value as string;
      const image = parseImage(val);
      return image ? { text: '', image, isError: false } : { text: val, isError: false };
    }
    if (r.type === 'number' || r.type === 'boolean') return { text: String(r.value), isError: false };
    if (r.objectId) {
      try {
        const s = await swCallFunctionOn(r.objectId,
          'function() { try { return JSON.stringify(this, null, 2); } catch(e) { return String(this); } }'
        ) as { result?: { value?: string } };
        const val = s?.result?.value;
        if (val) return { text: val, isError: false };
      } catch { /* fall through */ }
    }
    return { text: (r.description as string) ?? 'Done', isError: false };
  }

  try {
    const raw = await evalWithTimeout(command.trim());
    return formatResult(raw?.result);
  } catch (e: unknown) {
    return { text: e instanceof Error ? e.message : String(e), isError: true };
  }
}

/**
 * Like executeCommand but preserves the raw CDP result for object/array types.
 * Used by the Console to render expandable ObjectTree entries.
 */
export async function executeCommandForConsole(command: string): Promise<ConsoleCommandResult> {
  const cmdName = command.trim().toLowerCase();
  if (cmdName in CAPTURE_COMMANDS && !await captureAllowed(cmdName)) throw new Error('Permission not granted');
  if (cmdName === 'video-start') {
    const r = await startVideo();
    if (!r.ok) throw new Error(r.error || 'Failed');
    return { text: 'Video recording started' };
  }
  if (cmdName === 'video-stop') {
    const r = await stopVideo();
    if (!r.ok) throw new Error(r.error);
    return { text: 'Video recorded', video: r.blobUrl, duration: r.duration, size: r.size };
  }
  if (cmdName === 'tracing-start' || cmdName === 'tracing-stop') {
    const r = await chrome.runtime.sendMessage({ type: cmdName });
    if (!r?.ok) throw new Error(r?.error || 'Failed');
    if (cmdName === 'tracing-stop') return { text: r.text || 'Tracing stopped', trace: true, traceSize: r.size };
    return { text: 'Tracing started' };
  }

  const raw = await evalWithTimeout(command.trim());
  const r = raw?.result;

  if (!r || r.type === 'undefined') return { text: 'Done' };

  if (r.type === 'string') {
    const val = r.value as string;
    const image = parseImage(val);
    return image ? { text: '', image } : { text: val };
  }

  if (r.type === 'number' || r.type === 'boolean') return { text: String(r.value) };

  // object, array, function — return raw CDP result so Console can render ObjectTree
  return { cdpResult: r };
}

let attachSeq = 0;

/**
 * Attach to a tab. Attaches can overlap (a tab switch and a click on Attach), so only the
 * latest one counts: earlier ones resolve with `stale: true` and the caller ignores them.
 */
export async function attachToTab(tabId: number): Promise<{ ok: boolean; url?: string; error?: string; stale: boolean }> {
  const seq = ++attachSeq;
  const res = await chrome.runtime.sendMessage({ type: 'attach', tabId });
  return { ...res, stale: seq !== attachSeq };
}

/** Make any attach still in flight stale, e.g. when the user detaches meanwhile. */
export function cancelPendingAttach(): void {
  attachSeq++;
}
