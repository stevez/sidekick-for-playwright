// Assert Builder logic, ported from the playwright-repl VS Code extension (packages/vscode/src/assertView.ts).

export interface AssertionType {
    value: string;
    label: string;
    needsArg: boolean;
    argType?: 'string' | 'number' | 'pair';
    tags?: string[];  // element tags this applies to, empty = all
}

export const ALL_ASSERTION_TYPES: AssertionType[] = [
    // Text
    { value: 'toContainText', label: 'toContainText', needsArg: true, argType: 'string' },
    { value: 'toHaveText', label: 'toHaveText', needsArg: true, argType: 'string' },
    // Visibility & state
    { value: 'toBeVisible', label: 'toBeVisible', needsArg: false },
    { value: 'toBeHidden', label: 'toBeHidden', needsArg: false },
    { value: 'toBeAttached', label: 'toBeAttached', needsArg: false },
    { value: 'toBeEnabled', label: 'toBeEnabled', needsArg: false },
    { value: 'toBeDisabled', label: 'toBeDisabled', needsArg: false },
    // Form elements
    { value: 'toBeChecked', label: 'toBeChecked', needsArg: false, tags: ['input'] },
    { value: 'toHaveValue', label: 'toHaveValue', needsArg: true, argType: 'string', tags: ['input', 'textarea', 'select'] },
    // Attributes & count
    { value: 'toHaveAttribute', label: 'toHaveAttribute', needsArg: true, argType: 'pair' },
    { value: 'toHaveCount', label: 'toHaveCount', needsArg: true, argType: 'number' },
    // Page-level (uses expect(page) not expect(locator))
    { value: 'toHaveURL', label: 'toHaveURL (page)', needsArg: true, argType: 'string' },
    { value: 'toHaveTitle', label: 'toHaveTitle (page)', needsArg: true, argType: 'string' },
];

const PAGE_LEVEL = new Set(['toHaveURL', 'toHaveTitle']);

/** Matchers with a dedicated opposite: Not uses the opposite instead of `.not.` (toBeHidden reads better than not.toBeVisible). */
const OPPOSITES: Record<string, string> = {
    toBeVisible: 'toBeHidden',
    toBeHidden: 'toBeVisible',
    toBeEnabled: 'toBeDisabled',
    toBeDisabled: 'toBeEnabled',
};

/** Assertion types that apply to the picked element's tag (checkbox/radio drop toHaveValue). */
export function filterTypes(tag?: string, inputType?: string): AssertionType[] {
    const t = tag?.toLowerCase();
    const filtered = ALL_ASSERTION_TYPES.filter(a => !a.tags || !t || a.tags.includes(t));
    if (t === 'input' && (inputType === 'checkbox' || inputType === 'radio'))
        return filtered.filter(a => a.value !== 'toHaveValue');
    return filtered;
}

function quote(s: string): string {
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Build `await expect(...).[not.]<type>(<arg>);` from the builder's fields. */
export function buildAssertion(locator: string, type: string, arg = '', negate = false): string {
    const typeDef = ALL_ASSERTION_TYPES.find(t => t.value === type);
    if (!typeDef) return '';
    if (negate && OPPOSITES[type]) {
        type = OPPOSITES[type];
        negate = false;
    }
    const not = negate ? 'not.' : '';
    const target = PAGE_LEVEL.has(type) ? 'page' : locator;
    if (!target) return '';
    if (typeDef.argType === 'pair' && arg) {
        const [name = '', value = ''] = arg.split(',').map(s => s.trim());
        return `await expect(${target}).${not}${type}(${quote(name)}, ${quote(value)});`;
    }
    if (typeDef.needsArg && arg) {
        const argStr = typeDef.argType === 'number' ? arg : quote(arg);
        return `await expect(${target}).${not}${type}(${argStr});`;
    }
    return `await expect(${target}).${not}${type}();`;
}

/** Build a toMatchAriaSnapshot assertion from the picked element's aria snapshot. */
export function buildSnapshotAssertion(locator: string, snapshot: string, negate = false): string {
    if (!locator) return '';
    const not = negate ? 'not.' : '';
    return snapshot
        ? `await expect(${locator}).${not}toMatchAriaSnapshot(\`\n${snapshot}\n\`);`
        : `await expect(${locator}).${not}toMatchAriaSnapshot(\`\`);`;
}

/** Recover builder fields (type, arg, negate) from an assertion line, e.g. the picker's default. */
export function parseAssertion(assertion: string): { type: string; arg: string; negate: boolean } | null {
    const m = assertion.match(/\)\.(not\.)?(\w+)\((.*)\);?\s*$/s);
    if (!m || !ALL_ASSERTION_TYPES.some(t => t.value === m[2])) return null;
    let arg = m[3].trim();
    const str = arg.match(/^(['"])(.*)\1$/s);
    if (str) arg = str[2].replace(/\\(['"\\])/g, '$1');
    return { type: m[2], arg, negate: !!m[1] };
}

/** Shorten a failed expect() message to one line: expected/received, timeout, or the first error line. */
export function summarizeFailure(error: string): string {
    const full = (error || 'Assertion failed').replace(/^### \w[\w ]*\n/gm, '').trim();
    const expectedMatch = full.match(/Expected\s*(?:string|pattern|value)?:\s*(.+)/);
    const receivedMatch = full.match(/Received\s*(?:string|value)?:\s*(.+)/);
    const timeoutMatch = full.match(/Timed out (\d+)ms/);
    let short: string;
    if (expectedMatch && receivedMatch) {
        short = `expected: ${expectedMatch[1].trim()}, received: ${receivedMatch[1].trim()}`;
    } else if (timeoutMatch) {
        short = `Timed out (${timeoutMatch[1]}ms)`;
    } else {
        const msgMatch = full.match(/Error:\s*(.+?)(?:\n|$)/);
        short = msgMatch ? msgMatch[1].trim() : (full.split('\n')[0] || 'Assertion failed');
    }
    return short.length > 80 ? short.slice(0, 80) + '...' : short;
}
