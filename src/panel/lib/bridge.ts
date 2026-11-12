export type CommandResult = { text: string; isError: boolean; image?: string };
export type { CdpRemoteObject } from '@/components/Console/cdpToSerialized';
import type { CdpRemoteObject } from '@/components/Console/cdpToSerialized';
import { loadSettings } from './settings';

type CdpResult = { type?: string; value?: unknown; description?: string; objectId?: string };

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
