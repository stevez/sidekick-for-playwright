# Sidekick for Playwright

Chrome extension for Playwright engineers and QA: **record once — get the Playwright test and the video.**

Record a session as Playwright JavaScript, pick locators, build assertions, run or step-debug the script, and capture a video of the tab, all from a side panel. No Node.js setup needed: Playwright runs inside the extension via [`@playwright-repl/playwright-crx`](https://www.npmjs.com/package/@playwright-repl/playwright-crx).

## Status

Early scaffold. It was split off from [Dramaturg](https://github.com/stevez/playwright-repl/tree/main/packages/extension) as a plain copy and narrowed to JavaScript only, without the `.pw` keyword commands, CLI/MCP bridge, CDP relay or DevTools console.

Working: attach to a tab, record → Playwright JS, run the script, step debugger with breakpoints, element picker, console, tracing, video capture.

## Develop

Requires Node.js 20+.

```bash
npm install
npm run build        # outputs dist/
npm run typecheck
npm run lint
```

Load `dist/` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked), then click the toolbar icon to open the side panel.

## Permissions

| Permission | Why | When |
|---|---|---|
| `debugger` | Playwright drives the tab through `chrome.debugger` | install (Chrome doesn't allow it as optional) |
| `<all_urls>`, `scripting`, `webNavigation` | inject the recorder and follow navigations | install |
| `tabs`, `sidePanel`, `storage` | tab switcher, side panel, session state | install |
| `tabCapture`, `offscreen` | video recording | first video |
| `downloads` | save video / trace files | first save |

## Roadmap (v1)

- Export spec: wrap the script in `import { test, expect }` + `test('<page title>', async ({ page }) => { … })` and save as `.spec.ts` / `.spec.js`
- Remove the `.pw` output still produced internally by the recorder, locator and picker helpers (only the JS output is used)
- Icons and Web Store listing
- Tests: unit (Vitest) and E2E (Playwright, loading `dist/`)

## License

MIT
