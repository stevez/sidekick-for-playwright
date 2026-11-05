# Panel theme plan (issue #4)

Goal: make the side panel easier to read and give it a look of its own, tied to the
Electric violet icon. You do the styling; this is what to change and where.

## Status

Done in the first theme PR:
- **Assert tab:**
  - Numbered step cards with bold sans-serif titles.
  - Pick button with a label.
  - The verify result in its own tinted box above plain Verify / Insert buttons.
- **Fonts:** `--font-ui`, `--font-code` and `--font-size-code` variables. The toolbar and tabs use the UI font, and the editor reads its font from the variables.
- **Syntax colors:** new `--syntax-*` variables, shared by the editor, the console input (item 6 below) and logged objects. Keywords use the brand violet.
- **Contrast fixes:** line numbers and placeholder text.
- **Tab dropdown:** the toolbar's tab select is styled like the other inputs.

Still open:
- Body font. The panel body is still monospace, so text outside the toolbar, tabs and Assert tab is too.
- Accent color for active tabs, focus rings and selection (item 2).
- Darker Run green (item 3).
- Surfaces (item 4).
- Following the system theme (item 5).

## What makes it plain and hard to read today

- **Everything is monospace.** `html, body` in `panel.css` sets Cascadia Code / Consolas for the
  whole panel, so buttons, tabs and labels look like code.
- **Text is small.** Body text is 13px. Toolbar buttons are 11px. About 18 Tailwind classes use
  `text-[10px]`, `text-[11px]` or `text-[12px]`. The console's clear button is 10px.
- **No accent color.** The palette is VS Code Light+ / Dark+ grays plus blue and green. Nothing
  ties the panel to the icon.
- **Some colors fail contrast** (WCAG AA needs 4.5:1 for small text):

  | Token | Light | Dark |
  |---|---|---|
  | `--text-line-numbers` | 3.69 ✗ | 4.52 |
  | `--text-placeholder` | 2.61 ✗ | 2.24 ✗ |
  | white on `--color-run-bg` (Run button) | 3.37 ✗ | 3.37 ✗ |
  | `--text-dim` | 5.10 | 4.70 |

- **Dark mode ignores the system setting.** `Toolbar.tsx` starts in light mode unless
  `localStorage.theme` is `'dark'`.
- **The console's syntax colors aren't themed.** `cm-console-setup.ts` uses CodeMirror's
  `defaultHighlightStyle`, with fixed light-mode colors. The editor's `jsHighlightStyle` in
  `codemirror-setup.ts` uses the CSS variables.

## Proposal

### 1. Two fonts: UI and code

Add two variables and use them everywhere instead of literal font names and sizes:

```css
:root {
  --font-ui: system-ui, "Segoe UI", -apple-system, sans-serif;
  --font-code: "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace;
  --font-size-ui: 13px;
  --font-size-code: 13px;   /* try 14px */
}
```

- `html, body`: `font-family: var(--font-ui)`.
- **Code stays monospace:** the editor, console, variables and the locator / assertion text in
  the Assert tab use `var(--font-code)`.
- **Editor:** `codemirror-setup.ts` lines 21–22 hard-code `13px` and the font list. Change them to
  `var(--font-size-code)` and `var(--font-code)`, so there's one place to change. Raise
  `lineHeight` from `18px` to about `1.5`.
- **Small text:** raise the 10px and 11px sizes to at least 12px: toolbar buttons, the console's
  clear button, and the `text-[10px]` / `text-[11px]` Tailwind classes.

System UI fonts need no bundling. If you want a branded font instead (e.g. Inter), it has to be
bundled in `public/`, because extension pages shouldn't load fonts from a CDN.

### 2. Violet accent from the icon

The icon background is `#4c1d95` (Tailwind violet-900). Add an accent scale and use it for
focus and selection states, not large areas:

| Token | Light | Dark | Contrast |
|---|---|---|---|
| `--color-accent` | `#7c3aed` (violet-600) | `#a78bfa` (violet-400) | 5.70 on white / 6.13 on `#1e1e1e` |
| `--color-accent-strong` | `#6d28d9` (violet-700) | `#c4b5fd` (violet-300) | 7.10 / 9.03 |
| `--bg-accent-subtle` | `#f5f3ff` (violet-50) | `#2e1065` (violet-950) | background only |

Where to use it:
- Active tab underline (Console / Assert / Variables)
- The active mode-toggle button (`[data-testid="mode-toggle"] button[data-active]`)
- Focus rings (`:focus-visible`) on buttons and inputs
- The picking state of the Assert tab's pick button (`[data-testid="pick-btn"].picking`)
- `--color-splitter-handle-hover` (currently VS Code blue `#007acc`)
- Editor selection and the current-line background, as a light tint of the accent

Keep green for Run and red for Record and errors, so their meaning stays clear.

### 3. Fix the contrast failures

| Token | Light | Dark |
|---|---|---|
| `--text-line-numbers` | `#858585` → `#6e6e6e` (5.10) | keep |
| `--text-placeholder` | `#a0a0a0` → `#767676` (4.54) | `#555555` → `#8a8a8a` (4.83) |
| `--color-run-bg` | `#2ea043` → `#1a7f37` (white text 5.08) | same |

### 4. Softer surfaces

The panel uses pure white and `#1e1e1e` with thin gray borders. Separating the areas a bit more
makes it easier to scan:
- **Light:** body `#ffffff`, toolbar and tab bar `#f7f7f9`, borders `#e4e4e7`.
- **Dark:** body `#18181b`, toolbar `#202024`, borders `#2e2e33`. These are Tailwind zinc
  colors; they're cooler and sit well next to violet.
- Rounded buttons (`4px`) and a little more toolbar padding (`py-1.5`).

### 5. Follow the system theme

In `Toolbar.tsx`, when no theme is saved, start from
`window.matchMedia('(prefers-color-scheme: dark)').matches`. Keep the toggle as an override.

### 6. Theme the console's syntax colors

Replace `defaultHighlightStyle` in `cm-console-setup.ts` with the editor's `jsHighlightStyle`
(export it from `codemirror-setup.ts`), so the console uses the same CSS variables in light and
dark.

## Order

1. Font variables and sizes (biggest readability gain)
2. Contrast fixes
3. Accent color
4. Surfaces and spacing
5. System theme and console highlighting (small code changes; I can do these)

## Checking

- `npm run build`, reload the extension, compare light and dark.
- E2E tests don't depend on colors or fonts (they use `data-*` attributes), so `npm run test:e2e`
  should stay green. Run it anyway, since larger text can change wrapping.
- For before/after screenshots for the Web Store listing, use the panel at its default width
  (about 400px).
