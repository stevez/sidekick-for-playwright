# Sidekick launch plan

Goal: get Sidekick in front of Playwright engineers and QA, and turn store visits into installs that stick.

## Where we start (2026-11-13)

- v1.0.3 published on the Chrome Web Store on 2026-11-16: https://chromewebstore.google.com/detail/mogfomdgpoiedianojekjgoiobfkahob
- Dramaturg, the older sibling, has ~95 weekly users and ~1.8 store page views a day. Its listing was renamed on 2026-11-01 to test whether search-focused names bring traffic; results on 2026-11-21.
- What we learned from Dramaturg: **discovery is the bottleneck**, not retention. People who find it tend to keep it, but few find it. Store search alone won't do it; we need outside traffic.

## Targets (first 30 days after approval)

| Metric | Target | Where |
|---|---|---|
| Weekly users | 100 | Web Store dashboard |
| Store page views | 10/day in launch week, 3/day after | Web Store dashboard |
| Ratings | 5 | Store listing |
| GitHub stars | 50 | Repo |

These are guesses to measure against, not promises. Review them after launch week.

## Message

**One line:** Record once — get the Playwright test and the video.

**Three proof points**, in this order:
1. **Nothing to install.** No Node.js, no project, no terminal. Open the side panel on the page you're testing.
2. **Your real browser.** Record in the Chrome you already use, logged in, with your cookies, instead of a fresh browser that has to log in again.
3. **From click to spec in one panel.** Record, pick locators, build and verify assertions, step-debug, record a video, export a `.spec.ts`.

**Who it's for:** QA and test engineers who want a test without setting up a project first, and Playwright developers who want to try a flow or a locator on a live page.

**Tone:** "I built this, here's what it does", with a demo. Facts, not superlatives. Don't call other tools bad; show what Sidekick does that they don't (see the comparison in `docs/launch/comparison.md`).

## Assets

| Asset | File | Status |
|---|---|---|
| Comparison table | `docs/launch/comparison.md` | draft |
| Demo video script (~40 s) | `docs/launch/demo-script.md` | draft |
| Demo video + GIF | recorded by you, with Sidekick's own video feature | to do |
| README: store badge, comparison | `README.md` | done; GIF after the demo |
| Post drafts | `docs/launch/posts.md` | draft |
| Small promo tile 440×280 (optional) | `store/promo-tile.png` | to do |

## Channels

**Permanent listings** (slow, but they keep sending people):
- [awesome-playwright](https://github.com/mxschmitt/awesome-playwright): PR adding Sidekick under tools.
- GitHub repo: description, topics (`playwright`, `chrome-extension`, `test-recorder`, `codegen`, `test-automation`), GIF at the top of the README.
- Dramaturg: one line in its README and store description pointing JavaScript users to Sidekick.

**Launch posts**, spread over the week after approval:

| Day | Channel | Format |
|---|---|---|
| 1 (Tue/Wed) | LinkedIn | short post + demo video |
| 1 | r/Playwright | text post + GIF |
| 2 | dev.to | walkthrough article ("Write a Playwright test without installing anything") |
| 3 | r/QualityAssurance, r/softwaretesting | text post + GIF, linking the article |
| 4 | Show HN | plain title, weekday morning US time |
| any | Playwright Discord | only in a channel that allows showcases |
| any | X / Bluesky | demo video |

One channel at a time, so we can see which one brings visits (store page views by day).

**Ratings:** ask early users who say they like it to leave a rating. A handful of ratings matters for store search.

## Timeline

**Now, during review**
1. Comparison table, demo script and post drafts (Claude, in `docs/launch/`).
2. You record the demo video and GIF on the 1.0.3 build.
3. Promo tile (optional).
4. Prepare the README update and the awesome-playwright PR, ready to go once there's a store link.

**Approval day**
1. README: store badge, GIF, comparison table.
2. Repo description and topics.
3. awesome-playwright PR.
4. Dramaturg mention.

**Launch week:** posts per the table above. Answer every comment the same day; questions and bug reports are the best signal.

**After:** check store page views and weekly users weekly; write down which channel moved them. Fix what early users report first.

## Who does what

- **You:** anything that needs your accounts or your face: recording the demo, posting, replying, the Web Store dashboard.
- **Claude:** drafts, README and repo changes (as PRs), the awesome-playwright PR text, the comparison, metrics analysis from your CSV exports.
