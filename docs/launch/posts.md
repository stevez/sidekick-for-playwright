# Launch post drafts

Store link: https://chromewebstore.google.com/detail/mogfomdgpoiedianojekjgoiobfkahob (filled in below). Placeholders left: `[REPO]` = https://github.com/stevez/sidekick-for-playwright, `[VIDEO]` / `[GIF]` = the demo from `demo-script.md`. Edit freely: these should sound like you.

---

## LinkedIn (day 1, with the video)

I just released a Chrome extension I've been building: **Sidekick for Playwright**.

Record once — get the Playwright test and the video.

It's a side panel that turns what you do in a tab into Playwright code, without installing Node.js or setting up a project:

• Record clicks and typing as Playwright JavaScript, with getByRole / getByLabel / getByTestId locators
• Pick any element to get its locator, and build assertions you can verify on the live page before copying them
• Run the script with a pass/fail mark per line, or step through it with breakpoints
• Record a video of the session with clicks highlighted
• Export a ready-to-run .spec.ts

It runs in the Chrome you already use, so logged-in apps just work, with no saving and loading auth state.

It's free and open source (MIT). I'd love feedback from QA and test automation folks: what would make it part of your workflow?

https://chromewebstore.google.com/detail/mogfomdgpoiedianojekjgoiobfkahob

#Playwright #TestAutomation #QA #SoftwareTesting

---

## r/Playwright (day 1)

**Title:** I made a Chrome extension that records Playwright tests in your own browser (no Node.js needed)

Hi all — I've been building Sidekick for Playwright, a Chrome side panel for writing Playwright tests on a live page. [GIF]

What it does:
- Records clicks/typing as Playwright JS (role, label, test-id locators, same priorities as codegen)
- Locator picker with hover highlight
- Assertion builder: pick an element, choose a matcher (13 of them, or an ARIA snapshot), **verify it on the page**, then copy
- Run the script with pass/fail per line, step debugger with breakpoints and variables
- Video recording of the tab while you work
- Export to `.spec.ts` / `.spec.js`

Why not codegen? Codegen is great inside a project. I wanted something for the moments before that: trying a flow or a locator on an app I'm already logged into, without a terminal or saving auth state (Chrome 136+ also blocks automating your default profile).

Limits: Chrome only, JS/TS only, and Chrome shows a "started debugging this browser" bar while it's attached (Playwright drives the tab through the debugger API).

Free, MIT: https://chromewebstore.google.com/detail/mogfomdgpoiedianojekjgoiobfkahob · source: [REPO]

Feedback and bug reports very welcome.

---

## r/QualityAssurance and r/softwaretesting (day 3)

**Title:** Free Chrome extension to record Playwright tests + video without setting anything up

I built a side panel that records what you do in a tab as Playwright code, lets you build and check assertions on the live page, run or step-debug the script, record a video with clicks highlighted, and export a Playwright Test file.

Useful when you want to:
- turn a manual check into a first automated test quickly
- attach a video and a script to a bug report
- try locators on a page before writing them into your suite

No Node.js or project needed; it runs in your normal Chrome, logged in. [GIF]

https://chromewebstore.google.com/detail/mogfomdgpoiedianojekjgoiobfkahob — free and open source. I'm looking for feedback from testers on what's missing.

(Longer walkthrough: [DEVTO_LINK])

---

## dev.to article (day 2)

**Title:** Write a Playwright test without installing anything

**Tags:** playwright, testing, javascript, chrome

Outline:
1. **The problem.** Codegen and the VS Code extension are great once you have a project. Before that, getting one test needs Node, a project, and often re-logging into the app.
2. **Install Sidekick** (one click), open the side panel on the app.
3. **Record** a short flow on TodoMVC (screenshots).
4. **Add an assertion** in the Assert tab: pick, choose a matcher, Verify, copy.
5. **Run and debug**: pass/fail marks, a breakpoint, the Variables tab.
6. **Record a video** of the run for a bug report.
7. **Export** a `.spec.ts` and run it with `npx playwright test` in a real project.
8. **How it works**: Playwright running inside the extension (playwright-crx) through the Chrome debugger API; nothing leaves your browser.
9. **Limits and what's next**, link to the repo and issues.

---

## Show HN (day 4, weekday morning US time)

**Title:** Show HN: Sidekick – record and debug Playwright tests in a Chrome side panel

**URL:** [REPO] (HN prefers the source over a store page)

**First comment (post right after):**

I wanted a way to write Playwright tests on a live page without setting up a project, so I built a Chrome extension that runs Playwright inside the extension itself (via a fork of playwright-crx, using the chrome.debugger API).

It records actions as Playwright JS, has a locator picker and an assertion builder that verifies on the page, runs the script with per-line results, has a step debugger (breakpoints, variables), records a video of the tab, and exports a Playwright Test spec.

Trade-offs: Chrome only, it needs the debugger permission and host access to all sites (it has to work on whatever you test), and Chrome shows a debugging bar while it's attached. Nothing is sent anywhere.

Happy to answer questions about running Playwright inside an extension. MIT licensed.

---

## X / Bluesky (any day, with the short video)

Record once — get the Playwright test and the video.

Sidekick for Playwright: a Chrome side panel that records Playwright tests in the browser you already use. Verify assertions on the live page, step-debug, record video, export .spec.ts. No Node.js needed. Free + open source.

https://chromewebstore.google.com/detail/mogfomdgpoiedianojekjgoiobfkahob

---

## awesome-playwright PR (approval day)

**Section:** Tools (or Utils / Browser extensions, whichever exists)

**Line:**
`- [Sidekick for Playwright](https://github.com/stevez/sidekick-for-playwright) - Chrome side panel to record, verify assertions, step-debug and video-record Playwright tests in your own browser; exports .spec.ts.`

**PR title:** Add Sidekick for Playwright

---

## Dramaturg mention (approval day)

README / store description, near the top:

> Looking for a JavaScript-first tool? Try **Sidekick for Playwright** (https://chromewebstore.google.com/detail/mogfomdgpoiedianojekjgoiobfkahob): record, assert, debug and video-record Playwright tests in a side panel.
