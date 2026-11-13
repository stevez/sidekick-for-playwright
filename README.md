# Sidekick for Playwright

Chrome extension for Playwright engineers and QA: **record once — get the Playwright test and the video.**

Record a session as Playwright JavaScript, pick locators, build assertions, run or step-debug the script, and capture a video of the tab, all from a side panel. No Node.js setup needed: Playwright runs inside the extension via [`@playwright-repl/playwright-crx`](https://www.npmjs.com/package/@playwright-repl/playwright-crx).

## Status

Version 1.0.3, being submitted to the Chrome Web Store. It was split off from [Dramaturg](https://github.com/stevez/playwright-repl/tree/main/packages/extension) as a plain copy and narrowed to JavaScript only, without the `.pw` keyword commands, CLI/MCP bridge, CDP relay or DevTools console.

Working: attach to a tab, record → Playwright JS, run the script, step debugger with breakpoints, element picker, console, video capture (Playwright screencast of the attached tab, with clicks and actions highlighted; no extra permission), the **Assert** tab, and **Export spec**. The Assert tab is ported from the playwright-repl VS Code extension: pick an element, choose one of 13 matchers (or an ARIA snapshot), verify it on the live page, and copy it. Export spec wraps the script in a Playwright Test file (`.spec.ts` / `.spec.js`), with the test name taken from the page title. The panel can pop out into its own window and dock back, and its light and dark themes follow the system setting.

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

Load `dist/` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked), then click the toolbar icon to open the side panel.

## Permissions

| Permission | Why | When |
|---|---|---|
| `debugger` | Playwright drives the tab through `chrome.debugger` | install (Chrome doesn't allow it as optional) |
| `<all_urls>`, `scripting`, `webNavigation` | inject the recorder and follow navigations | install |
| `tabs`, `sidePanel`, `storage` | tab switcher, side panel, session state | install |

## Roadmap (v1)

- Publish to the Chrome Web Store (listing text and privacy answers in [`docs/webstore-listing.md`](docs/webstore-listing.md))

## Privacy

No data collection; see [PRIVACY.md](PRIVACY.md).

## License

MIT
