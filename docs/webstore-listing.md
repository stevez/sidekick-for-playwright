# Chrome Web Store listing

Text to paste into the Developer Dashboard. The title and summary come from `public/manifest.json` (`name`, `description`), so change them there.

## Store listing

**Title** (manifest `name`, max 75): Sidekick for Playwright – Test Recorder, Debugger & Video

**Summary** (manifest `description`, max 132): Record once — get the Playwright test and the video. Record, pick locators, and run or debug Playwright JavaScript in a side panel.

**Category:** Developer Tools

**Language:** English

### Description

```
Record once — get the Playwright test and the video.

Sidekick for Playwright records what you do in a tab as Playwright JavaScript, helps you pick locators and build assertions, runs and debugs the script, and captures a video of the session. Everything runs in a side panel, or in its own window: no Node.js, no project setup, no server.

RECORD
• Clicks, typing, selects, checks and navigations become Playwright code as you go
• Locators follow Playwright's own priorities: getByRole, getByLabel, getByText, getByTestId
• Code goes straight into the editor, where you can edit it

PICK LOCATORS
• Click any element to get its Playwright locator and accessible role and name
• Hover the locator to highlight the element on the page
• Copy it, or send it to the Assert tab

BUILD ASSERTIONS
• Pick an element, choose a matcher (toBeVisible, toHaveText, toHaveValue, toBeChecked, …) or an ARIA snapshot
• Verify it on the live page before you copy it: see "expected" vs "received" when it fails

RUN AND DEBUG
• Run the script with one click, with pass/fail marks on each line
• Breakpoints, Step Over / Into / Out, and inline variable values
• Autocompletion for the full Playwright API, page / locator / expect
• Console for one-off Playwright expressions

VIDEO
• Record a video of the tab, with clicks and actions highlighted, and save it as WebM

EXPORT
• Export the script as a Playwright Test file (.spec.ts or .spec.js), ready to drop into your project and run with npx playwright test
• Open and save plain .js scripts

WORKSPACE
• Pop Sidekick out into its own window for more room, and dock it back to the side panel
• Your script, breakpoints and history are kept when you close and reopen the panel
• Light and dark themes that follow your system

Built for Playwright engineers and QA who want to go from "I clicked through it" to a working test fast.

Playwright runs inside the extension through the Chrome debugger API, so Chrome shows a "started debugging this browser" bar while Sidekick is attached. Nothing you record leaves your browser.

Open source (MIT): https://github.com/stevez/sidekick-for-playwright

Sidekick is an independent project and is not affiliated with Microsoft or the Playwright team.
```

## Graphics

| Asset | Size | Status |
|---|---|---|
| Store icon | 128×128 PNG | `public/icons/icon128.png` |
| Screenshots (1–5) | 1280×800 PNG | `store/screenshots/` |
| Small promo tile | 440×280 PNG | to do (optional) |

The screenshots are generated: `npm run build`, then `npm run store:screenshots` (headed, uses the live TodoMVC demo). Each one shows the page on the left and the panel on the right:

1. Record and run: a recorded TodoMVC flow in the editor
2. Pick locator: the "Active" link highlighted, with its locator in the console
3. Assert tab: `toBeChecked` on a checked todo, Verify passed
4. Debugger paused on a breakpoint, with the Variables tab open
5. Export spec dialog

## Privacy practices

**Single purpose:** Record, write, run and debug Playwright browser tests for the page in the current tab, from a side panel.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `debugger` | Playwright drives and inspects the attached tab through the Chrome DevTools Protocol to run the user's test script, pick elements, and record video. |
| `sidePanel` | The extension's whole UI (editor, console, Assert tab) lives in the side panel. |
| `tabs` | Shows the open tabs in the toolbar so the user can choose which tab to attach to, and follows the active tab. |
| `scripting` | Injects the recorder into the page to capture clicks and typing as Playwright code. |
| `storage` | Keeps the editor content, breakpoints and command history while the panel is closed and reopened (session storage, local only). |
| `webNavigation` | Re-injects the recorder after the page navigates so recording continues across pages. |
| Host permission `<all_urls>` | Users test arbitrary sites, so the recorder and Playwright must work on any page the user chooses to attach to. |

**Remote code:** No. All code is bundled in the package.

**Data usage:** The extension does not collect or transmit user data. Leave every data type unchecked, and certify:
- not sold or transferred to third parties
- not used for purposes unrelated to the single purpose
- not used for creditworthiness or lending

**Privacy policy URL:** https://github.com/stevez/sidekick-for-playwright/blob/main/PRIVACY.md
