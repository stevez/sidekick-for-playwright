import { describe, it, expect } from 'vitest';
import { buildAssertion, buildSnapshotAssertion, filterTypes, parseAssertion, summarizeFailure } from '@/lib/assert-builder';

const loc = "page.getByRole('button', { name: 'Submit' })";

describe('filterTypes', () => {
    const values = (tag?: string, type?: string) => filterTypes(tag, type).map(t => t.value);

    it('drops form-only matchers for non-form elements', () => {
        expect(values('button')).not.toContain('toBeChecked');
        expect(values('button')).not.toContain('toHaveValue');
        expect(values('button')).toContain('toContainText');
    });

    it('keeps value but not checked for textarea', () => {
        expect(values('textarea')).toContain('toHaveValue');
        expect(values('textarea')).not.toContain('toBeChecked');
    });

    it('keeps checked but not value for checkboxes and radios', () => {
        for (const type of ['checkbox', 'radio']) {
            expect(values('input', type)).toContain('toBeChecked');
            expect(values('input', type)).not.toContain('toHaveValue');
        }
    });

    it('returns everything when the tag is unknown', () => {
        expect(values()).toHaveLength(13);
    });
});

describe('buildAssertion', () => {
    it('builds a no-arg matcher', () => {
        expect(buildAssertion(loc, 'toBeVisible')).toBe(`await expect(${loc}).toBeVisible();`);
    });

    it('negates with not.', () => {
        expect(buildAssertion(loc, 'toHaveText', 'Hi', true)).toBe(`await expect(${loc}).not.toHaveText('Hi');`);
        expect(buildAssertion(loc, 'toBeChecked', '', true)).toBe(`await expect(${loc}).not.toBeChecked();`);
    });

    it('uses the opposite matcher instead of not. when there is one', () => {
        expect(buildAssertion(loc, 'toBeVisible', '', true)).toBe(`await expect(${loc}).toBeHidden();`);
        expect(buildAssertion(loc, 'toBeHidden', '', true)).toBe(`await expect(${loc}).toBeVisible();`);
        expect(buildAssertion(loc, 'toBeEnabled', '', true)).toBe(`await expect(${loc}).toBeDisabled();`);
        expect(buildAssertion(loc, 'toBeDisabled', '', true)).toBe(`await expect(${loc}).toBeEnabled();`);
    });

    it('quotes and escapes string args', () => {
        expect(buildAssertion(loc, 'toHaveText', "It's \\ok")).toBe(`await expect(${loc}).toHaveText('It\\'s \\\\ok');`);
    });

    it('leaves number args unquoted', () => {
        expect(buildAssertion(loc, 'toHaveCount', '3')).toBe(`await expect(${loc}).toHaveCount(3);`);
    });

    it('splits attribute pairs', () => {
        expect(buildAssertion(loc, 'toHaveAttribute', 'type, submit')).toBe(`await expect(${loc}).toHaveAttribute('type', 'submit');`);
    });

    it('targets page for page-level matchers, even without a locator', () => {
        expect(buildAssertion('', 'toHaveTitle', 'Home')).toBe(`await expect(page).toHaveTitle('Home');`);
    });

    it('returns empty for an element matcher without a locator, or an unknown type', () => {
        expect(buildAssertion('', 'toBeVisible')).toBe('');
        expect(buildAssertion(loc, 'toBeShiny')).toBe('');
    });

    it('omits the arg when it is empty', () => {
        expect(buildAssertion(loc, 'toHaveText')).toBe(`await expect(${loc}).toHaveText();`);
    });
});

describe('buildSnapshotAssertion', () => {
    it('wraps the snapshot in a template literal', () => {
        expect(buildSnapshotAssertion(loc, '- button "Submit"')).toBe(`await expect(${loc}).toMatchAriaSnapshot(\`\n- button "Submit"\n\`);`);
    });

    it('supports negation and an empty snapshot', () => {
        expect(buildSnapshotAssertion(loc, '', true)).toBe(`await expect(${loc}).not.toMatchAriaSnapshot(\`\`);`);
    });
});

describe('parseAssertion', () => {
    it('recovers type, string arg and negation', () => {
        expect(parseAssertion(`await expect(${loc}).toContainText('It\\'s here');`)).toEqual({ type: 'toContainText', arg: "It's here", negate: false });
        expect(parseAssertion(`await expect(${loc}).not.toBeChecked();`)).toEqual({ type: 'toBeChecked', arg: '', negate: true });
    });

    it('round-trips with buildAssertion', () => {
        const line = buildAssertion(loc, 'toHaveValue', 'Ada', true);
        const p = parseAssertion(line)!;
        expect(buildAssertion(loc, p.type, p.arg, p.negate)).toBe(line);
    });

    it('returns null for unknown matchers', () => {
        expect(parseAssertion(`await expect(${loc}).toMatchAriaSnapshot(\`\`);`)).toBeNull();
    });
});

describe('summarizeFailure', () => {
    it('shows expected vs received', () => {
        const err = 'Error: expect(locator).toHaveText(expected) failed\n\nExpected string: "Hello"\nReceived string: "Bye"';
        expect(summarizeFailure(err)).toBe('expected: "Hello", received: "Bye"');
    });

    it('shows timeouts', () => {
        expect(summarizeFailure('Error: Timed out 5000ms waiting for expect(locator).toBeVisible()')).toBe('Timed out (5000ms)');
    });

    it('falls back to the first error line and truncates', () => {
        expect(summarizeFailure('Error: ' + 'x'.repeat(100))).toBe('x'.repeat(80) + '...');
    });
});
