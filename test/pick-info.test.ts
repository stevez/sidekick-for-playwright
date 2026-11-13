import { describe, it, expect } from 'vitest';
import { buildPickResult } from '@/lib/pick-info';
import type { ElementPickInfo } from '@/types';

function info(overrides: Partial<ElementPickInfo>): ElementPickInfo {
    return {
        locator: "getByRole('button', { name: 'Submit' })",
        tag: 'button',
        text: 'Submit',
        html: '<button>Submit</button>',
        attributes: {},
        visible: true,
        enabled: true,
        box: { x: 0, y: 0, width: 10, height: 10 },
        ...overrides,
    };
}

describe('buildPickResult', () => {
    it('builds the highlight expression and a text assertion', () => {
        const r = buildPickResult(info({}), undefined, '- button "Submit" [ref=e5]');
        expect(r.locator).toBe("page.getByRole('button', { name: 'Submit' })");
        expect(r.jsExpression).toBe("await page.getByRole('button', { name: 'Submit' }).highlight();");
        expect(r.assertJs).toBe("await expect(page.getByRole('button', { name: 'Submit' })).toContainText('Submit');");
        expect(r.ref).toBe('e5');
    });

    it('suggests toBeVisible when the accessible name is not in the text (aria-hidden counter, visually hidden text)', () => {
        // GitHub's "Closed" tab: <div>Closed</div><span aria-hidden>20</span><span hidden-visually>&nbsp;(20)</span>
        const r = buildPickResult(info({ locator: "getByRole('link', { name: 'Closed\u00a0 (20)' })", tag: 'a', text: 'Closed\n20\n (20)', textContent: 'Closed20 (20)' }), undefined, '- link "Closed\u00a0(20)"');
        expect(r.assertJs).toBe("await expect(page.getByRole('link', { name: 'Closed\u00a0 (20)' })).toBeVisible();");
    });

    it('normalizes whitespace in the name it asserts', () => {
        const r = buildPickResult(info({ locator: "getByRole('button', { name: 'Save  draft' })", text: 'Save draft', textContent: 'Save draft' }), undefined, '- button "Save\u00a0 draft"');
        expect(r.assertJs).toBe("await expect(page.getByRole('button', { name: 'Save  draft' })).toContainText('Save draft');");
    });

    it('prefers the full aria name over a substring locator name', () => {
        const r = buildPickResult(info({ locator: "getByRole('button', { name: 'Sub' })", text: 'Submit form' }), undefined, '- button "Submit form"');
        expect(r.assertJs).toBe("await expect(page.getByRole('button', { name: 'Sub' })).toContainText('Submit form');");
    });

    it('uses the cdp locator when given', () => {
        const r = buildPickResult(info({}), "getByTestId('go')");
        expect(r.jsExpression).toBe("await page.getByTestId('go').highlight();");
    });

    it('asserts checked state for checkboxes', () => {
        const base = { locator: "getByRole('checkbox', { name: 'Agree' })", tag: 'input', text: '', attributes: { type: 'checkbox' } };
        expect(buildPickResult(info({ ...base, checked: true })).assertJs)
            .toBe("await expect(page.getByRole('checkbox', { name: 'Agree' })).toBeChecked();");
        expect(buildPickResult(info({ ...base, checked: false })).assertJs)
            .toBe("await expect(page.getByRole('checkbox', { name: 'Agree' })).not.toBeChecked();");
    });

    it('asserts the value of inputs, escaping quotes', () => {
        const r = buildPickResult(info({ locator: "getByLabel('Name')", tag: 'input', text: '', value: "O'Brien" }));
        expect(r.assertJs).toBe("await expect(page.getByLabel('Name')).toHaveValue('O\\'Brien');");
    });

    it('asserts visibility for a link identified only by URL', () => {
        const r = buildPickResult(info({ locator: "locator('a.logo')", tag: 'a', text: 'Home' }), undefined, '- link:\n  - /url: /home');
        expect(r.assertJs).toBe("await expect(page.locator('a.logo')).toBeVisible();");
    });

    it('does not repeat the text of a getByText locator', () => {
        const r = buildPickResult(info({ locator: "getByText('Hello')", tag: 'p', text: 'Hello' }));
        expect(r.assertJs).toBe("await expect(page.getByText('Hello')).toBeVisible();");
    });

    it('falls back to element text for CSS locators', () => {
        const r = buildPickResult(info({ locator: "locator('div.card')", tag: 'div', text: 'Card body' }));
        expect(r.assertJs).toBe("await expect(page.locator('div.card')).toContainText('Card body');");
    });

    it('asserts visibility when there is no text', () => {
        const r = buildPickResult(info({ locator: "locator('img.hero')", tag: 'img', text: '' }));
        expect(r.assertJs).toBe("await expect(page.locator('img.hero')).toBeVisible();");
    });
});
