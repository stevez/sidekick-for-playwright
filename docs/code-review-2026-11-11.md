# Code review — 2026-11-11

Full-repo review covering `src/panel/lib/`, `src/panel/components/`, `src/content/`, `public/manifest.json`, and build/CI config. Findings are read-only observations, not yet fixed unless noted.

## High — security / correctness

1. **Manifest is maximally over-permissioned** — [public/manifest.json](../public/manifest.json) grants `<all_urls>` host permissions alongside `debugger` and `scripting`. That's the ceiling of what Chrome allows; any future XSS in the panel or scripting bug could CDP-attach to any open tab, including banking/intranet pages.

2. **Trace viewer can hand off recorded data to a hijacked tab** — [src/background.ts:436-452](../src/background.ts#L436-L452) waits for the trace-viewer tab to reach `complete`, then injects the loader and `sendMessage`s the full trace without re-checking the tab's URL is still `trace.playwright.dev`. [src/content/trace-loader.ts:4-9](../src/content/trace-loader.ts#L4-L9) compounds it — no origin check on the inbound `postMessage`.

3. **Racing attach logic, two places** — [src/panel/App.tsx:107-117](../src/panel/App.tsx#L107-L117) and [src/panel/components/Toolbar.tsx:97-108](../src/panel/components/Toolbar.tsx#L97-L108) each independently call `attachToTab` and dispatch to the same reducer. Concurrent triggers (tab-switch + manual click) race; the later-resolving promise silently wins, desyncing `attachedTabId` from the `attachedTabRef` that only App.tsx tracks.

4. **Service worker blocks on trace export** — [src/background.ts:410-413](../src/background.ts#L410-L413) base64-encodes a multi-MB trace via a per-byte `String.fromCharCode` loop, freezing all other `chrome.runtime` message handling (panel looks hung) while it runs.

5. **Listener leak on abandoned trace popup** — same handler region in background.ts only removes its `chrome.tabs.onUpdated` listener on `status === 'complete'`; closing the popup early leaks it for the service worker's lifetime.

## Medium

6. `sw-debugger.ts` `eagerSerialize` ([:122-146](../src/panel/lib/sw-debugger.ts#L122-L146)) uses one `visited` Set across the whole tree, so two sibling properties pointing at the *same* object (not a cycle) get wrongly flagged `circular` — real console data silently dropped.

7. Same file: array serialization copies all property descriptors including `length` and miscounts `len`, producing a spurious/incorrect length in console output.

8. [video-recorder.ts:48-60](../src/panel/lib/video-recorder.ts#L48-L60) sizes the recording canvas once from the first frame; a mid-recording viewport resize distorts/stretches later frames instead of adapting.

9. [Console/ObjectTree.tsx:90-99](../src/panel/components/Console/ObjectTree.tsx#L90-L99) — `fetchedRef` never resets, so a node whose `objectId` changes (new value, same tree slot) keeps rendering stale expanded children.

10. [VariablePane.tsx:40-48](../src/panel/components/VariablePane.tsx#L40-L48) — `fetchProps` has no cancellation; rapid stepping causes an older response to overwrite a newer one, and can `setState` after the Variables tab unmounts.

11. [src/content/recorder.ts](../src/content/recorder.ts) cross-frame messaging (lines ~143/157/187) uses `postMessage(..., '*')` with no `e.origin` check — any cross-origin frame holding the window reference can feed it selector data.

12. [src/content/locator.ts:291,302,316,334](../src/content/locator.ts#L291) — full-DOM `querySelectorAll('*')` scans run synchronously inside every recorded click/input, can visibly jank large SPAs while recording.

## Low — maintainability / polish

13. Duplicated save-file flow between [file-utils.ts:1-19](../src/panel/lib/file-utils.ts#L1-L19) and [video-recorder.ts:114-130](../src/panel/lib/video-recorder.ts#L114-L130) — a fix in one won't propagate to the other.

14. [command-history.ts](../src/panel/lib/command-history.ts) keeps an unbounded in-memory history array for the life of the panel.

15. [snapshot-parser.ts:24](../src/panel/lib/snapshot-parser.ts#L24) `toNodes` only reads `Object.keys(obj)[0]`, silently dropping extra YAML keys if ever present.

16. [CodeMirrorEditorPane.tsx:92-101](../src/panel/components/CodeMirrorEditorPane.tsx#L92-L101) unconditionally steals focus on every external content sync, which can yank focus away from the console mid-typing.

17. [Splitter.tsx:16,32](../src/panel/components/Splitter.tsx#L16) uses non-null ref assertions that can throw on a mistimed drag event.

18. No `aria-label`/`role` on icon-only buttons anywhere in `src/panel/components/`; [Lightbox.tsx:9-27](../src/panel/components/Lightbox.tsx#L9-L27) has no Escape handling, no dialog role, and its `<img>` lacks `alt`.

19. `@types/chrome` pinned at `0.0.304`, three majors stale ([package.json:45](../package.json#L45)).

20. CI workflow has no `permissions:` block and no dependency-audit/CodeQL step, notable given the `<all_urls>` + `debugger` footprint.

## Already fixed

- `App.tsx:42` — the session-restore `useEffect` used an inline async IIFE; extracted into a named `restoreSession` function with an unmount guard (`cancelled` flag) to match the existing `saveSession` pattern and avoid a stale dispatch after unmount.
- `background.ts` `tracing-stop`/`tracing-view` handlers used inline async IIFEs inside `chrome.runtime.onMessage`; extracted into named `stopTracing()`/`viewTrace()` functions in the "Tracing" section, matching the file's existing `attachToTab`/`startRecording`/`pickElement` pattern. (Items #4 and #5 were fixed afterwards, see below.)

## Resolution

Fixed on branch `fix/code-review`:

| # | Fix |
|---|---|
| 2 | `viewTrace` only injects the loader if the tab is still on `https://trace.playwright.dev`. `trace-loader.ts` only accepts messages from this extension, only runs on the Trace Viewer origin, and posts to that origin instead of `'*'`. |
| 3 | `attachToTab` (panel side) reports `stale` when a newer attach started meanwhile, and `cancelPendingAttach()` runs on every detach. App and Toolbar ignore stale results. App's `attachedTabRef` follows `state.attachedTabId`, so toolbar attaches keep it in sync. `DETACH` also clears `isAttaching`. |
| 4 | Base64 is built in 32 KB chunks (`toBase64`) instead of one character at a time. |
| 5 | `viewTrace` also removes its `onUpdated` listener when the tab closes early (`tabs.onRemoved`). |
| 6 | `eagerSerialize` tracks only the ancestors on the current path, so shared (non-cyclic) references are no longer marked circular. |
| 7 | Arrays take `len` from their `length` property and leave `length` out of `props`. |
| 8 | Frames are drawn fitted (letterboxed) into the canvas, so a mid-recording resize no longer stretches the video. The encoder size stays fixed by the first frame. |
| 9 | `ObjectTree` remembers which `objectId` its children belong to and refetches when it changes; responses for an old object are ignored. |
| 10 | `VariablePane` ignores responses from older requests and after unmount. |
| 13 | One `saveUrlAs()` in `file-utils.ts` is shared by screenshot/PDF and video saving, along with `fileTimestamp()`. |
| 14 | Command history keeps the newest 500 commands. |
| 15 | `toNodes` turns every key of a YAML mapping into a node. |
| 16 | An external editor update only takes focus when nothing else (such as the console input) has it. |
| 17 | `Splitter` checks the ref instead of using non-null assertions. |
| 18 | `Lightbox` closes on Escape and has `role="dialog"`, `aria-modal`, an `alt` and a labelled close button. Icon-only toolbar buttons already have a `title`, which gives them an accessible name. |
| 20 | CI runs with `permissions: contents: read`. |

Not changed:

- **#1 (permissions):** `<all_urls>`, `debugger` and `scripting` are what the extension does: test any site the user attaches to. The store listing justifies each one. Narrowing to `activeTab` plus optional host permissions would be a product change (a permission prompt per site), so it needs its own decision.
- **#11 (recorder `postMessage`):** frame paths are only accepted from `window.parent` (`e.source === window.parent`), and replies only go to windows that are one of our own frames (`sendPathToChild` checks `contentWindow`). An origin check doesn't fit, because the frames are cross-origin by design. The data is a frame selector, not page content.
- **#12 (full-DOM scans):** only runs on the element the user just clicked or typed into, and the role check short-circuits before the expensive name computation. Needs profiling on a large app before changing locator logic.
- **#19 (`@types/chrome`):** the package moved from `0.0.x` to `0.3.x`. Upgrading is worth its own PR, since it can change many Chrome API types at once.
- A CodeQL / dependency-audit step (part of #20) is left for a separate CI change.

Tests: `tsc`, ESLint, unit tests (49 plus 2 new in `test/review-fixes.test.ts` for #14 and #15) and all 15 E2E tests pass. Viewing a trace (#2, #4, #5), a viewport resize while recording video (#8), and the attach race (#3) aren't covered by automated tests.
