import { describe, it, expect } from 'vitest';
import { buildSpec, defaultTestName, specFileName } from '@/lib/export-spec';

describe('buildSpec', () => {
    it('wraps the script body in a Playwright test', () => {
        const body = [
            `await page.goto("https://example.com/");`,
            `await page.getByRole('button', { name: 'Greet' }).click();`,
        ].join('\n');
        expect(buildSpec(body, 'greets the user')).toBe([
            `import { test, expect } from '@playwright/test';`,
            ``,
            `test('greets the user', async ({ page }) => {`,
            `  await page.goto("https://example.com/");`,
            `  await page.getByRole('button', { name: 'Greet' }).click();`,
            `});`,
            ``,
        ].join('\n'));
    });

    it('trims leading/trailing blank lines but keeps blank lines inside', () => {
        const spec = buildSpec('\n\nawait a();\n\nawait b();\n\n', 't');
        expect(spec).toContain(`=> {\n  await a();\n\n  await b();\n});`);
    });

    it('keeps existing indentation and strips trailing whitespace', () => {
        const spec = buildSpec('if (x) {\n  await a();   \n}', 't');
        expect(spec).toContain(`  if (x) {\n    await a();\n  }\n`);
    });

    it('normalizes CRLF line endings', () => {
        expect(buildSpec('await a();\r\nawait b();', 't')).not.toContain('\r');
    });

    it('escapes quotes, backslashes and newlines in the test name', () => {
        expect(buildSpec('', `it's a\\b\nc`)).toContain(`test('it\\'s a\\\\b c', async`);
    });

    it('falls back to a default name when the name is blank', () => {
        expect(buildSpec('await a();', '   ')).toContain(`test('recorded test', async`);
    });

    it('produces an empty test body for an empty script', () => {
        expect(buildSpec('', 't')).toContain(`async ({ page }) => {\n});`);
    });
});

describe('defaultTestName', () => {
    it('uses the page title, collapsing whitespace', () => {
        expect(defaultTestName('  Sign in \n to   Acme ')).toBe('Sign in to Acme');
    });

    it('falls back when there is no title', () => {
        expect(defaultTestName(undefined)).toBe('recorded test');
        expect(defaultTestName('   ')).toBe('recorded test');
    });
});

describe('specFileName', () => {
    it('slugifies the test name with the chosen extension', () => {
        expect(specFileName('Sign in to Acme!', 'ts')).toBe('sign-in-to-acme.spec.ts');
        expect(specFileName('Sign in to Acme!', 'js')).toBe('sign-in-to-acme.spec.js');
    });

    it('strips accents and caps the length', () => {
        expect(specFileName('Café crème', 'ts')).toBe('cafe-creme.spec.ts');
        expect(specFileName('a'.repeat(100), 'ts')).toBe(`${'a'.repeat(60)}.spec.ts`);
    });

    it('falls back when nothing usable is left', () => {
        expect(specFileName('日本語', 'js')).toBe('recorded-test.spec.js');
    });
});
