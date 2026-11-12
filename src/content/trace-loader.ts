// Content script injected into trace.playwright.dev
// Receives trace data from the background SW and loads it via postMessage.

const TRACE_VIEWER_ORIGIN = 'https://trace.playwright.dev';

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'load-trace' || !msg.data) return;
  // Only our service worker, and only into the real Trace Viewer page
  if (sender.id !== chrome.runtime.id || location.origin !== TRACE_VIEWER_ORIGIN) return;
  const bytes = new Uint8Array(msg.data);
  const blob = new Blob([bytes], { type: 'application/zip' });
  window.postMessage({ method: 'load', params: { trace: blob } }, TRACE_VIEWER_ORIGIN);
});

// Signal ready
chrome.runtime.sendMessage({ type: 'trace-loader-ready' });
