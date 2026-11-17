# Sidekick for Playwright

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/mogfomdgpoiedianojekjgoiobfkahob?label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/mogfomdgpoiedianojekjgoiobfkahob)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Chrome extension for Playwright engineers and QA: **record once — get the Playwright test and the video.**

Record a session as Playwright JavaScript, pick locators, build assertions, run or step-debug the script, and capture a video of the tab, all from a side panel. No Node.js setup needed: Playwright runs inside the extension via [`@playwright-repl/playwright-crx`](https://www.npmjs.com/package/@playwright-repl/playwright-crx).

## Install

**[Add to Chrome from the Chrome Web Store](https://chromewebstore.google.com/detail/mogfomdgpoiedianojekjgoiobfkahob)**, then click the toolbar icon on any page to open the side panel.

## Features

- **Record** clicks and typing as Playwright JavaScript, with `getByRole` / `getByLabel` / `getByTestId` locators
- **Pick** any element to get its locator, with a hover highlight on the page
- **Assert**: pick an element, choose one of 13 matchers (or an ARIA snapshot), verify it on the live page, then copy it
- **Run** the script with a pass/fail mark per line, or **step-debug** it with breakpoints and variables
- **Video** of the tab while you work, with clicks and actions highlighted
- **Export** a ready-to-run Playwright Test file (`.spec.ts` / `.spec.js`)
- Pop the panel out into its own window; light and dark themes follow the system setting

## How it compares

| | Sidekick | `npx playwright codegen` | Playwright VS Code extension |
|---|---|---|---|
| Setup | Install the extension | Node.js + Playwright, from a terminal | VS Code + Node.js + a Playwright project |
| Where you record | The Chrome you already use, logged in | A separate browser Playwright launches | A separate browser Playwright launches |
| Assertions | 13 matchers + ARIA snapshot, verified on the live page | Visibility, text, value | Visibility, text, value |
| Step debugger | In the panel | Playwright Inspector (`--debug`) | VS Code debugger |
| Video while you work | Yes | Only for test runs | Only for test runs |
| Languages | JavaScript / TypeScript | Several | TypeScript / JavaScript |

Sidekick doesn't replace codegen or the VS Code extension: it's for getting from "I clicked through it" to a first working test fast, and for trying locators and assertions on a live page. The export is a normal Playwright Test file you run with `npx playwright test`.

**Limits:** Chrome only, JavaScript/TypeScript only, no trace recording yet ([#20](https://github.com/stevez/sidekick-for-playwright/issues/20)), and Chrome shows a "started debugging this browser" bar while Sidekick is attached.

## Status

Version 1.0.3, [on the Chrome Web Store](https://chromewebstore.google.com/detail/mogfomdgpoiedianojekjgoiobfkahob). Split off from [Dramaturg](https://github.com/stevez/playwright-repl/tree/main/packages/extension) and narrowed to JavaScript only, without the `.pw` keyword commands, CLI/MCP bridge, CDP relay or DevTools console. Store listing text and privacy answers are in [`docs/webstore-listing.md`](docs/webstore-listing.md).

## Develop

Requires Node.js 20+.

```bash
npm install
npm run build        # outputs dist/
npm run typecheck
npm run lint
npm test             # unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright, loads dist/ — build first)
```

The first E2E run needs a browser: `npx playwright install chromium`.

To try a local build, load `dist/` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked), then click the toolbar icon to open the side panel.

## Permissions

| Permission | Why | When |
|---|---|---|
| `debugger` | Playwright drives the tab through `chrome.debugger` | install (Chrome doesn't allow it as optional) |
| `<all_urls>`, `scripting`, `webNavigation` | inject the recorder and follow navigations | install |
| `tabs`, `sidePanel`, `storage` | tab switcher, side panel, session state | install |

## Privacy

No data collection; see [PRIVACY.md](PRIVACY.md).

## License

MIT
