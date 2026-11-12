# Privacy Policy — Sidekick for Playwright

**Last updated:** November 11, 2026

## Data collection

Sidekick for Playwright does not collect, store on any server, transmit, sell or share user data. It has no analytics and no accounts. Everything runs locally in your browser.

## What stays in your browser

- **Panel session:** the editor content, breakpoints and command history are kept in `chrome.storage.session` so they survive closing and reopening the panel. Chrome clears this storage when the browser closes.
- **Recordings and videos:** created in memory and only saved to disk when you choose to save or export them.

## Permissions

- **debugger** — Playwright drives the attached tab through the Chrome DevTools Protocol to run your script, pick elements, and record video.
- **sidePanel** — the extension's UI.
- **tabs** — lists open tabs so you can choose which one to attach to.
- **scripting** and **webNavigation** — inject the recorder into the page and keep it running across navigations.
- **storage** — the panel session described above.
- **Host access to all sites** — so you can record and test any page you choose.

## Third-party services

The extension contacts no external service.

## Changes

Updates to this policy will be posted on this page.

## Contact

Questions: open an issue at https://github.com/stevez/sidekick-for-playwright/issues
