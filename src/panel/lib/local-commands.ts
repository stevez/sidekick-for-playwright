import type React from 'react';
import type { Action } from '@/reducer';
import { getCommandHistory, clearHistory } from '@/lib/command-history';

// ─── Playwright cheat sheet ──────────────────────────────────────────────────

const JS_CATEGORIES: Record<string, string[]> = {
    'Navigation':   ['page.goto(url)', 'page.goBack()', 'page.reload()', '...'],
    'Locators':     ['page.getByRole(role)', 'page.getByText(text)', 'page.locator(sel)', 'page.getByTestId(id)', '...'],
    'Actions':      ['.click()', '.fill(value)', '.press(key)', '.hover()', '.selectOption(value)', '...'],
    'Query':        ['.textContent()', '.getAttribute(name)', '.isVisible()', '.count()', '...'],
    'Assertions':   ['expect(loc).toBeVisible()', '.toHaveText()', '.toHaveValue()', 'expect(page).toHaveTitle()', '.toHaveURL()', '...'],
    'Wait':         ['page.waitForSelector(sel)', 'page.waitForLoadState()', 'page.waitForURL(url)'],
    'Evaluate':     ['page.evaluate(() => expr)'],
    'Other':        ['page.screenshot()', 'page.keyboard.press(key)', 'page.mouse.click(x, y)', '...'],
};

function helpText(): string {
    const jsLines = Object.entries(JS_CATEGORIES)
        .map(([cat, methods]) => `  ${cat}: ${methods.join(', ')}`)
        .join('\n');
    const globals = [
        '  Available globals:',
        '    page      — Playwright Page object (active browser tab)',
        '    context   — Playwright BrowserContext (cookies, pages, routes)',
        '    expect    — Playwright assertion (expect(locator).toBeVisible())',
        '',
        '  For DOM access use: await page.evaluate(() => document.title)',
    ].join('\n');
    const local = '  Console commands: clear, history, history clear, log time on|off, video-start, video-stop, tracing-start, tracing-stop';
    return `Playwright JavaScript — prefix async methods with await\n\n${globals}\n\n${jsLines}\n\n${local}`;
}

// ─── Local commands ──────────────────────────────────────────────────────────

/** Handle console-only commands that don't run in the page. Returns true if handled. */
export function runLocalCommand(command: string, dispatch: React.Dispatch<Action>): boolean {
    const trimmed = command.trim().toLowerCase();
    if (trimmed === 'clear') {
        dispatch({ type: 'CLEAR_CONSOLE' });
        return true;
    }
    if (trimmed === 'help') {
        dispatch({ type: 'ADD_LINE', line: { text: helpText(), type: 'info' } });
        return true;
    }
    if (trimmed === 'history clear') {
        clearHistory();
        dispatch({ type: 'ADD_LINE', line: { text: 'History cleared.', type: 'info' } });
        return true;
    }
    if (trimmed === 'history') {
        const history = getCommandHistory();
        dispatch({ type: 'ADD_LINE', line: { text: history.length ? history.join('\n') : '(no history)', type: 'info' } });
        return true;
    }
    if (trimmed === 'log time on' || trimmed === 'log time off') {
        const on = trimmed.endsWith('on');
        localStorage.setItem('logTime', String(on));
        dispatch({ type: 'ADD_LINE', line: { text: `Time logging ${on ? 'enabled' : 'disabled'}`, type: 'info' } });
        return true;
    }
    return false;
}
