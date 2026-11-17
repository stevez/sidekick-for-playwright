# How Sidekick compares

For the README and launch posts. Facts checked against the Playwright docs ([Test generator](https://playwright.dev/docs/codegen)) on 2026-11-13; recheck before posting. Keep the tone factual: these are different tools for different moments, and Sidekick exports to the same Playwright Test format.

## Table

| | **Sidekick for Playwright** | Playwright codegen (`npx playwright codegen`) | Playwright VS Code extension |
|---|---|---|---|
| Setup | Install the Chrome extension | Node.js + Playwright installed, run from a terminal | VS Code + Node.js + a Playwright project |
| Where you record | **The Chrome you already use**, already logged in | A separate browser that Playwright launches | A separate browser that Playwright launches |
| Logged-in sites | Just works | Log in again, or `--save-storage` / `--load-storage`, or a separate profile (Chrome 136+ blocks automation of the default profile) | Same as codegen |
| Record actions as code | Yes (JavaScript) | Yes (JS/TS, Python, Java, .NET) | Yes (into a `.spec.ts`) |
| Pick a locator | Yes, with hover highlight on the live page | Yes | Yes |
| Assertions | 13 matchers + ARIA snapshot, **verified on the live page** before you copy them | Visibility, text, value (recorded from the page) | Visibility, text, value |
| Run the script | One click, pass/fail mark per line | Run it as a test from the terminal | Yes |
| Step debugger | Breakpoints, step over/into/out, variables | Playwright Inspector when running a test with `--debug` | Yes (VS Code debugger) |
| Video of the session | **Yes, while you work**, with clicks highlighted, saved as WebM | Only for test runs (`video` option in the config) | Only for test runs |
| Output | Export `.spec.ts` / `.spec.js` (Playwright Test) | Copy the code | Writes the test file |
| Languages | JavaScript / TypeScript only | Several | TypeScript / JavaScript |

## What to say (and not say)

- **Say:** "No install, in the browser you already use", "verify assertions on the live page", "record a video while you work", "exports a normal Playwright Test file".
- **Don't say** it replaces codegen or the VS Code extension. Teams with a Playwright project will keep using them for running and maintaining suites; Sidekick is for getting from "I clicked through it" to a first working test fast, and for trying locators and assertions on a live page.
- **Be upfront about limits:** Chrome only, JavaScript/TypeScript only, no trace recording yet (#20), and Chrome shows a "started debugging this browser" bar while Sidekick is attached.

## Short version (for posts)

> Playwright's codegen and VS Code extension need Node.js and a project, and record in a fresh browser. Sidekick is a Chrome side panel: record in the browser you're already logged into, check assertions on the live page, step through the script, record a video, and export a `.spec.ts`. No install beyond the extension.
