// ─── Global extensions (background.ts) ──────────────────────────────────────
// These are ambient declarations (script-context .d.ts) — no `declare global` needed.

// Exposed on globalThis so scripts evaluated in the service worker can switch tabs
declare var attachToTab: (tabId: number) => Promise<{ ok: boolean; url?: string; error?: string }>;

// ─── Window extensions ───────────────────────────────────────────────────────

interface Window {
  __pwRecorderCleanup?: () => void;
  __pw_recorder_active?: boolean;
  showSaveFilePicker(options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }): Promise<FileSystemFileHandle>;
}

// ─── File System Access API (not in default DOM types) ───────────────────────

interface FileSystemFileHandle {
  name: string;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: Blob | string | ArrayBuffer): Promise<void>;
  close(): Promise<void>;
}

// ─── Chrome Extension APIs (missing from @types/chrome) ─────────────────────

declare namespace chrome {
  namespace sidePanel {
    function setPanelBehavior(options: { openPanelOnActionClick: boolean }): void;
    function open(options: { windowId?: number }): Promise<void>;
  }

  namespace scripting {
    interface ScriptInjection {
      target: { tabId: number; allFrames?: boolean };
      files?: string[];
      func?: () => void;
    }
    function executeScript(injection: ScriptInjection): Promise<unknown>;
  }

  namespace offscreen {
    function hasDocument(): Promise<boolean>;
    function createDocument(options: { url: string; reasons: string[]; justification: string }): Promise<void>;
    const Reason: { USER_MEDIA: string };
  }

  namespace action {
    const onClicked: { addListener: (callback: (tab: { id?: number; url?: string; windowId?: number }) => void) => void };
  }

  namespace tabCapture {
    function getMediaStreamId(options: { targetTabId?: number }): Promise<string>;
  }
}

// ─── vitest-chrome (no published types) ──────────────────────────────────────

declare module "vitest-chrome/lib/index.esm.js" {
  const chrome: typeof globalThis.chrome;
  export = chrome;
}
