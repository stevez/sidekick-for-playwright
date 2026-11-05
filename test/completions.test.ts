import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { extractCompletions } from '../scripts/completions';
import { playwrightCompletions } from '@/lib/pw-completion-source';

const data = extractCompletions();
const labels = (name: string) => data[name].map(m => m.label);

/** Completion labels offered with the cursor at the end of `doc` */
function complete(doc: string): string[] {
    const context = new CompletionContext(EditorState.create({ doc }), doc.length, false);
    return playwrightCompletions(context)?.options.map(o => o.label) ?? [];
}

describe('extractCompletions', () => {
    it('reads members from the bundled Playwright types', () => {
        expect(labels('Page')).toEqual(expect.arrayContaining(['goto', 'getByRole', 'keyboard', 'localStorage']));
        expect(labels('Locator')).toEqual(expect.arrayContaining(['click', 'fill', 'within']));
        expect(labels('FrameLocator')).toContain('getByRole');
    });

    it('reads matchers and skips modifiers', () => {
        expect(labels('LocatorAssertions')).toEqual(expect.arrayContaining(['toBeVisible', 'toHaveText', 'toMatchAriaSnapshot']));
        expect(labels('PageAssertions')).toEqual(expect.arrayContaining(['toHaveTitle', 'toHaveURL']));
        expect(labels('GenericAssertions')).toEqual(expect.arrayContaining(['toBe', 'toEqual']));
        expect(labels('LocatorAssertions')).not.toContain('not');
    });

    it('drops deprecated and legacy members', () => {
        expect(labels('Page')).not.toContain('$eval');
        expect(labels('Page')).not.toContain('waitForTimeout');
        expect(labels('Locator')).toContain('isVisible');
    });

    it('marks optional parameters and sync return types', () => {
        const goto = data.Page.find(m => m.label === 'goto')!;
        expect(goto.detail).toMatch(/^\(url: string, options\?: /);
        expect(data.Page.find(m => m.label === 'getByRole')!.returns).toBe('Locator');
        expect(data.Page.find(m => m.label === 'keyboard')!.returns).toBe('Keyboard');
        expect(goto.returns).toBeUndefined(); // returns a Promise
    });
});

describe('playwrightCompletions', () => {
    it('completes page members', () => {
        expect(complete('page.')).toEqual(expect.arrayContaining(['goto', 'localStorage']));
    });

    it('follows chains through locator-returning methods', () => {
        expect(complete("page.getByRole('button').")).toContain('click');
        expect(complete("page.locator('#a').within(form).")).toContain('setInputFiles');
        expect(complete('page.keyboard.')).toContain('press');
    });

    it('offers matchers by subject', () => {
        expect(complete("expect(page.getByText('Hi')).")).toContain('toBeVisible');
        expect(complete('expect(page).')).toEqual(expect.arrayContaining(['toHaveTitle', 'toHaveURL']));
        expect(complete('expect(count).')).toContain('toBe');
        expect(complete('expect(count).')).not.toContain('toBeVisible');
    });
});
