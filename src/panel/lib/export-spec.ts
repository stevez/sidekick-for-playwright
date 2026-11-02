// ─── Export spec ─────────────────────────────────────────────────────────────
// The editor holds a script body (top-level `await page...` lines). Export wraps it
// in a Playwright Test file. The body is valid TypeScript as-is, so the same
// wrapper serves both .spec.ts and .spec.js.

export type SpecFormat = 'ts' | 'js';

const DEFAULT_TEST_NAME = 'recorded test';

/** Test name pre-filled from the page title; falls back to a generic name. */
export function defaultTestName(pageTitle: string | undefined): string {
    const name = pageTitle?.replace(/\s+/g, ' ').trim();
    return name || DEFAULT_TEST_NAME;
}

/** Quote `name` as a single-quoted JS string literal. */
function quote(name: string): string {
    return `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ')}'`;
}

/** Wrap a script body in `import { test, expect }` + `test(name, async ({ page }) => { ... })`. */
export function buildSpec(body: string, testName: string): string {
    const lines = body.replace(/\r\n/g, '\n').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const indented = lines.map(line => line.trim() ? `  ${line.replace(/\s+$/, '')}` : '');
    const name = quote(testName.trim() || DEFAULT_TEST_NAME);
    return [
        `import { test, expect } from '@playwright/test';`,
        ``,
        `test(${name}, async ({ page }) => {`,
        ...indented,
        `});`,
        ``,
    ].join('\n');
}

/** File name for the exported spec, e.g. "Sign in page" → "sign-in-page.spec.ts". */
export function specFileName(testName: string, format: SpecFormat): string {
    const slug = testName
        .toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '');
    return `${slug || 'recorded-test'}.spec.${format}`;
}
