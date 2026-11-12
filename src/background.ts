import { crx } from '@playwright-repl/playwright-crx';
import type { CrxApplication } from '@playwright-repl/playwright-crx';
import { expect } from '@playwright-repl/playwright-crx/test';
import type { Page } from '@playwright-repl/playwright-crx/test';

// ─── Suppress Chrome-internal "No SW" error ─────────────────────────────────
// Chromium's extension_function_dispatcher.cc rejects with "No SW" when the
// service worker's render process is gone before an in-flight Chrome API call
// completes. This is a known Chrome bug — purely console noise, no functional
// impact.  Suppress it so it doesn't pollute the SW console during debugging.
// https://groups.google.com/a/chromium.org/g/chromium-extensions/c/rHFKotXbm-0
self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  if (event.reason?.message === 'No SW' || String(event.reason) === 'Error: No SW') {
    event.preventDefault();
  }
});

// ─── Service worker lifecycle logging ────────────────────────────────────────

chrome.runtime.onSuspend.addListener(() => {
  console.debug('[sidekick] onSuspend — service worker suspending');
});

chrome.runtime.onStartup.addListener(() => {
  console.debug('[sidekick] onStartup — browser cold start');
});

chrome.runtime.onInstalled.addListener((details) => {
  console.debug(`[sidekick] onInstalled — reason: ${details.reason}`);
});

// ─── Patch toMatchAriaSnapshot ──────────────────────────────────────────────
// toMatchAriaSnapshot requires currentTestInfo() which only exists inside the
// Playwright Test runner. We wrap expect() with a Proxy that intercepts this
// matcher and calls locator._expect() directly, bypassing the test-info check
// while using Playwright's own matching engine.
// Note: _expect() is a private Playwright API — may break on upgrades.

function dedentSnapshot(snapshot: string) {
  const lines = snapshot.split('\n').filter(l => l.trim());
  const prefix = Math.min(...lines.map(l => l.match(/^(\s*)/)![1].length));
  return lines.map(line => line.substring(prefix)).join('\n');
}

function makeAriaSnapshotMatcher(locator: unknown, isNot: boolean) {
  const loc = locator as { _expect: (type: string, opts: { expectedValue: string; isNot: boolean; timeout: number }) => Promise<{ matches: boolean; received?: { raw?: string } }> };
  return async (expected: string, options?: { timeout?: number }) => {
    const timeout = options?.timeout ?? 5000;
    const normalized = dedentSnapshot(expected);
    const { matches: pass, received } = await loc._expect(
      'to.match.aria',
      { expectedValue: normalized, isNot, timeout },
    );
    if (isNot ? pass : !pass) {
      const actual = received?.raw ?? '';
      const expectedOneLine = normalized.replace(/\n/g, ' ↵ ');
      const actualOneLine = actual.replace(/\n/g, ' ↵ ');
      throw new Error(
        isNot
          ? `toMatchAriaSnapshot (not)\nExpected: not to match\nReceived: ${actualOneLine}\n\nFull expected:\n${normalized}\n\nFull received:\n${actual}`
          : `toMatchAriaSnapshot\nExpected: ${expectedOneLine}\nReceived: ${actualOneLine}\n\nFull expected:\n${normalized}\n\nFull received:\n${actual}`
      );
    }
  };
}

function wrapExpectResult(e: object, locator: unknown, isNot = false) {
  return new Proxy(e, {
    get(obj, prop) {
      if (prop === 'toMatchAriaSnapshot')
        return makeAriaSnapshotMatcher(locator, isNot);
      if (prop === 'not')
        return wrapExpectResult(Reflect.get(obj, prop), locator, !isNot);
      return Reflect.get(obj, prop);
    },
  });
}

const _origExpect = expect;
const patchedExpect: typeof expect = Object.assign(
  (target: unknown) => wrapExpectResult(_origExpect(target) as object, target),
  _origExpect,
);

// ─── Side panel ──────────────────────────────────────────────────────────────

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(e => console.debug('[sidekick] setPanelBehavior:', e));

// ─── playwright-crx State ────────────────────────────────────────────────────

let crxApp: CrxApplication | null = null;
let currentPage: Page | null = null;
let activeTabId: number | null = null;

function resetCrxState() {
  crxApp = null;
  currentPage = null;
  activeTabId = null;
}

async function ensureCrxApp(): Promise<CrxApplication> {
  if (crxApp) return crxApp;
  crxApp = await crx.start();
  (crxApp as unknown as { on: (event: string, cb: () => void) => void }).on('close', () => resetCrxState());
  return crxApp;
}

function isAttachableUrl(url: string | undefined): boolean {
  if (!url) return true; // no URL info — let attachToTab decide
  if (url.startsWith('chrome://')) return false;
  if (url.startsWith('edge://')) return false;
  if (url.startsWith('https://chromewebstore.google.com')) return false;
  if (url.startsWith('chrome-extension://') && !url.startsWith(`chrome-extension://${chrome.runtime.id}/`)) return false;
  return true;
}

async function getActiveTabId(): Promise<number | null> {
  if (activeTabId) {
    // Validate cached tab is still alive and attachable
    try {
      const tab = await chrome.tabs.get(activeTabId);
      if (isAttachableUrl(tab.url)) return activeTabId;
    } catch { /* tab no longer exists */ }
    activeTabId = null;
    currentPage = null;
  }
  // Try focused window first
  const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (focused?.id && isAttachableUrl(focused.url)) return focused.id;
  // Fall back to any active tab (handles Chrome not being the focused app)
  const [active] = await chrome.tabs.query({ active: true });
  if (active?.id && isAttachableUrl(active.url)) return active.id;
  // All active tabs are restricted — find any regular tab
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.id && isAttachableUrl(t.url)) return t.id;
  }
  return null;
}

// ─── Tab Attachment ───────────────────────────────────────────────────────────

async function attachToTab(tabId: number): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const tab = await chrome.tabs.get(tabId);
    const ownOrigin = `chrome-extension://${chrome.runtime.id}/`;
    const url = tab.url ?? '';
    if (url.startsWith('chrome://') || url.startsWith('edge://') ||
        (url.startsWith('chrome-extension://') && !url.startsWith(ownOrigin)) ||
        url.startsWith('https://chromewebstore.google.com')) {
      if (activeTabId === tabId) {
        activeTabId = null;
        currentPage = null;
      }
      return { ok: false, error: 'Cannot attach to this page — browser restricts extension access. Navigate to a regular webpage first.' };
    }

    const app = await ensureCrxApp();

    // Only detach when re-attaching to the SAME tab (SPA navigation / stale frames).
    // playwright-crx supports multiple attached pages, so switching tabs is safe.
    if (activeTabId === tabId) {
      await app.detach(activeTabId).catch(e => console.debug('[sidekick] detach before reattach:', e));
      currentPage = null;
      activeTabId = null;
    }

    try {
      currentPage = await app.attach(tabId);
    } catch {
      // Attach failed (stale frames, etc.) — detach all stale sessions and retry.
      // The _doDetach fix in playwright-crx handles broken pages gracefully.
      await app.detachAll().catch(e => console.debug('[sidekick] detachAll before retry:', e));
      currentPage = await app.attach(tabId);
    }

    activeTabId = tabId;
    Object.assign(globalThis, { page: currentPage, context: app.context(), crxApp: app, activeTabId, expect: patchedExpect });

    // With no 'dialog' listener Playwright auto-dismisses dialogs; keep one so the
    // user can answer them in the page while recording (scripts can still add their own).
    currentPage.on('dialog', () => {});

    return { ok: true, url: currentPage.url() };
  } catch (e) {
    // Don't reset crxApp — the browser connection is likely still valid.
    // Only clear the page/tab so the next command triggers a fresh attach.
    currentPage = null;
    activeTabId = null;
    return { ok: false, error: String(e) };
  }
}

// ─── Recording ───────────────────────────────────────────────────────────────

let recordingTabId: number | null = null;
async function startRecording(): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const tabId = await getActiveTabId();
    if (!tabId) return { ok: false, error: 'No active tab' };
    const tab = await chrome.tabs.get(tabId);
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content/recorder.js'] });
    recordingTabId = tabId;
    return { ok: true, url: tab.url ?? '' };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function stopRecording(): Promise<{ ok: boolean }> {
  if (recordingTabId) {
    await chrome.tabs.sendMessage(recordingTabId, { type: 'record-stop' }).catch(e => console.debug('[sidekick] record-stop:', e));
    recordingTabId = null;
  }
  return { ok: true };
}

// Re-inject recorder after navigation (page reload / SPA navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === recordingTabId && changeInfo.status === 'complete') {
    chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content/recorder.js'] }).catch(e => console.debug('[sidekick] recorder re-inject:', e));
  }
});

// Capture navigation during recording:
// - reload → emit reload
// - cross-origin back/forward → emit go-back (as fallback; same-origin handled by Navigation API in recorder.ts)
// Dedup: content script sends nav-handled when Navigation API traverse fires
let lastNavHandledAt = 0;

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.tabId !== recordingTabId || details.frameId !== 0) return;
  const qualifiers = details.transitionQualifiers ?? [];
  const isBackForward = details.transitionType === 'back_forward' || qualifiers.includes('forward_back');
  if (isBackForward) {
    // Delay to let content script's nav-handled arrive first (same-origin handled by Navigation API)
    const url = details.url;
    setTimeout(() => {
      if (Date.now() - lastNavHandledAt > 300) {
        // Not handled by content script — cross-origin fallback using goto
        chrome.runtime.sendMessage({ type: 'recorded-action', action: { js: `await page.goto('${url}');` } }).catch(() => {});
      }
    }, 150);
  } else if (details.transitionType === 'reload' && !qualifiers.includes('forward_back')) {
    chrome.runtime.sendMessage({ type: 'recorded-action', action: { js: 'await page.reload();' } }).catch(() => {});
  }
});

// Invalidate stale state when a tab is closed (user clicks X, tab-close command, etc.)
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    currentPage = null;
    activeTabId = null;
  }
  if (tabId === recordingTabId) {
    recordingTabId = null;
  }
});

// ─── Video Capture ──────────────────────────────────────────────────────────

// Playwright's page.screencast streams JPEG frames of the attached page over the debugger
// connection; the panel encodes them into a .webm (see panel/lib/video-recorder.ts).
// No tabCapture: it only works on tabs where the user clicked the extension icon.

const VIDEO_MAX_WIDTH = 1280;

let videoPage: Page | null = null;
let videoStartTime = 0;

async function startVideoCapture(): Promise<{ ok: boolean; error?: string }> {
  if (videoPage) return { ok: false, error: 'Already recording' };
  const page = currentPage;
  if (!page) return { ok: false, error: 'Attach to a tab first' };

  try {
    const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    const scale = Math.min(1, VIDEO_MAX_WIDTH / viewport.width);
    const even = (n: number) => Math.max(2, Math.round(n * scale / 2) * 2); // video encoders want even dimensions
    await page.screencast.start({
      size: { width: even(viewport.width), height: even(viewport.height) },
      onFrame: frame => {
        chrome.runtime.sendMessage({ type: 'video-frame', data: frame.data.toString('base64'), timestamp: frame.timestamp }).catch(() => {});
      },
    });
    await page.screencast.showActions({ position: 'bottom' }); // like subtitles: clear of headers and nav
    videoPage = page;
    videoStartTime = Date.now();
    return { ok: true };
  } catch (e) {
    await page.screencast.stop().catch(() => {});
    return { ok: false, error: String(e) };
  }
}

async function stopVideoCapture(): Promise<{ ok: boolean; error?: string; duration?: number }> {
  if (!videoPage) return { ok: false, error: 'Not recording' };
  const page = videoPage;
  videoPage = null;
  const duration = Math.round((Date.now() - videoStartTime) / 1000);
  // The page may already be gone (tab closed / detached); the panel still finalizes what it has
  await page.screencast.hideActions().catch(e => console.debug('[sidekick] hideActions:', e));
  await page.screencast.stop().catch(e => console.debug('[sidekick] screencast.stop:', e));
  return { ok: true, duration };
}

// ─── Pick Element ────────────────────────────────────────────────────────────

async function pickElement(): Promise<{ ok: boolean; info?: Record<string, unknown>; error?: string }> {
  if (!currentPage) {
    const tabId = await getActiveTabId();
    if (tabId) await attachToTab(tabId);
    if (!currentPage) return { ok: false, error: 'No active page' };
  }

  // Validate that currentPage is still alive — re-attach if stale
  try {
    await currentPage.title();
  } catch (e) {
    console.debug('[sidekick] pick: stale page detected, re-attaching...', e);
    currentPage = null;
    const tabId = await getActiveTabId();
    if (tabId) await attachToTab(tabId);
    if (!currentPage) return { ok: false, error: 'Page connection lost — please try again' };
  }

  try {
    const locator = await currentPage.pickLocator();
    const locatorStr = locator.toString();
    const ariaSnapshot = await locator.ariaSnapshot({ mode: 'ai' }).catch(() => '');
    const elementInfo = await locator.evaluate((el: Element) => {
      const attrs: Record<string, string> = {};
      for (const attr of el.attributes) attrs[attr.name] = attr.value;
      const tag = el.tagName;
      const inputType = (attrs.type || '').toLowerCase();

      return {
        tag: tag.toLowerCase(), // pick-info and the assert builder compare lowercase tags
        text: (el as HTMLElement).innerText?.slice(0, 200) ?? '',
        html: el.outerHTML?.slice(0, 500) ?? '',
        attributes: attrs,
        visible: true,
        enabled: !(el as HTMLInputElement).disabled,
        box: el.getBoundingClientRect().toJSON(),
        value: ('value' in el) ? (el as HTMLInputElement).value : undefined,
        checked: (tag === 'INPUT' && (inputType === 'checkbox' || inputType === 'radio'))
          ? (el as HTMLInputElement).checked : undefined,
      };
    }).catch(() => null);

    return {
      ok: true,
      info: {
        locator: locatorStr,
        ariaSnapshot,
        ...(elementInfo || {}),
      },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('cancelled')) return { ok: false, error: 'cancelled' };
    return { ok: false, error: msg };
  }
}

async function cancelPick(): Promise<{ ok: boolean }> {
  if (currentPage) {
    try { await currentPage.cancelPickLocator(); } catch { /* ignore */ }
  }
  return { ok: true };
}

// ─── Message Handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'attach')        { attachToTab(msg.tabId).then(sendResponse); return true; }
  if (msg.type === 'detach')        {
    if (activeTabId !== null && crxApp) {
      crxApp.detach(activeTabId).catch(e => console.debug('[sidekick] detach:', e));
      currentPage = null;
      activeTabId = null;
    }
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'health')        { sendResponse({ ok: !!crxApp }); return false; }
  if (msg.type === 'nav-handled')   { lastNavHandledAt = Date.now(); return; }
  if (msg.type === 'record-start')  { startRecording().then(sendResponse); return true; }
  if (msg.type === 'record-stop')   { stopRecording().then(sendResponse); return true; }
  if (msg.type === 'pick')           { pickElement().then(sendResponse); return true; }
  if (msg.type === 'pick-cancel')   { cancelPick().then(sendResponse); return true; }
  if (msg.type === 'video-start')   { startVideoCapture().then(sendResponse); return true; }
  if (msg.type === 'video-stop')    { stopVideoCapture().then(sendResponse); return true; }
  if (msg.type === 'video-state')   { sendResponse({ recording: !!videoPage, startTime: videoStartTime }); return false; }
  if (msg.type === 'video-preview') {
    chrome.windows.create({ url: msg.blobUrl, type: 'popup', width: 1280, height: 720 });
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'ping') { sendResponse({ pong: true }); return false; }
  return false;
});

// Expose stable globals for swDebugEval — functions that never change go here, not inside attachToTab
globalThis.attachToTab = attachToTab;
