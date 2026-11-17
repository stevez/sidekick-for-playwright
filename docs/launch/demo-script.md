# Demo video script (~40 seconds)

One take per shot, recorded with Sidekick's own video button where possible (it highlights clicks), or a screen recorder for the whole Chrome window so the side panel shows. Export an MP4 for LinkedIn / X / YouTube, and a GIF (first 15–20 s, under ~8 MB) for the README and Reddit.

**Setup**
- Chrome window ~1280×800, side panel open on the right (~420 px wide), light theme.
- Site: https://demo.playwright.dev/todomvc/ (public, no login, everyone recognizes it).
- Empty editor, console cleared. Turn off notifications.

## Shots

| # | Time | On screen | Caption (burned in, or say it) |
|---|---|---|---|
| 1 | 0–3 s | TodoMVC page with Sidekick's panel open | **Record Playwright tests in the browser you already use.** |
| 2 | 3–12 s | Click Record. Add "Buy milk" and "Write tests", tick "Write tests". Stop. Code appears in the editor line by line | Clicks and typing become Playwright code. |
| 3 | 12–20 s | Assert tab → Pick → click the "1 item left" counter. Suggestion appears; click **Verify** → green "Passed". Copy | Build an assertion and check it on the live page. |
| 4 | 20–27 s | Paste the assertion into the editor. Reload the page, click ▶. Lines get pass marks | Run it. Every line gets a pass or fail mark. |
| 5 | 27–33 s | Set a breakpoint, click Debug, Step Over twice, Variables tab open | Step through it with breakpoints and variables. |
| 6 | 33–38 s | Export → "Save .spec.ts" → the file in an editor, showing `test(...)` | Export a real Playwright Test file. |
| 7 | 38–42 s | Sidekick icon + name | **Sidekick for Playwright** — free on the Chrome Web Store. No Node.js needed. |

## Tips

- Slow down: pause half a second after each click so viewers can follow.
- Zoom the browser to 110–125% so code is readable in a phone feed.
- Keep the "started debugging this browser" bar out of frame if you can (crop the top), or leave it in: it's honest and explained in the listing.
- Shorter cut for X / Reddit: shots 2, 3, 4, 7 (~25 s).
