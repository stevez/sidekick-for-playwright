# Privacy Policy — Sidekick for Playwright

**Last updated:** November 5, 2026

## Data collection

Sidekick for Playwright does not collect, store on any server, transmit, sell or share user data. It has no analytics and no accounts. Everything runs locally in your browser.

## What stays in your browser

- **Panel session:** the editor content, breakpoints and command history are kept in `chrome.storage.session` so they survive closing and reopening the panel. Chrome clears this storage when the browser closes.
- **Recordings, videos and traces:** created in memory and only saved to disk when you choose to save or export them.

## Permissions

- **debugger** — Playwright drives the attached tab through the Chrome DevTools Protocol to run your script, pick elements, and record video and traces.
- **sidePanel** — the extension's UI.
- **tabs** — lists open tabs so you can choose which one to attach to.
- **scripting** and **webNavigation** — inject the recorder into the page and keep it running across navigations.
- **storage** — the panel session described above.
- **downloads** (optional, asked at first use) — saves trace files.
- **Host access to all sites** — so you can record and test any page you choose.

## Third-party services

When you choose **View trace**, the extension opens Playwright's Trace Viewer at `https://trace.playwright.dev/` and loads your trace into that page. The Trace Viewer runs in your browser; see its own documentation for details. The extension contacts no other external service.

## Changes

Updates to this policy will be posted on this page.

## Contact

Questions: open an issue at https://github.com/stevez/sidekick-for-playwright/issues
