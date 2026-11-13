import type { ElementPickInfo, PickResultData } from '@/types';

// ─── Aria snapshot parsing ──────────────────────────────────────────────

type AriaNode = { role: string; name: string };

/**
 * Parse an aria snapshot YAML line into role + name.
 * e.g. `- button "Submit"` → { role: 'button', name: 'Submit' }
 * e.g. `- listitem:` → { role: 'listitem', name: '' }
 */
function parseAriaLine(line: string): AriaNode | null {
    const trimmed = line.replace(/^\s*-\s*/, '').replace(/:$/, '')
        .replace(/(\s*\[[\w\s=]+\])+\s*$/, ''); // strip aria attributes like [ref=e1], [cursor=pointer]
    // role "name" or role 'name'
    const match = trimmed.match(/^(\w[\w-]*)\s+["'](.+?)["']$/);
    if (match) return { role: match[1], name: match[2] };
    // role only (no name)
    const roleOnly = trimmed.match(/^(\w[\w-]*)$/);
    if (roleOnly) return { role: roleOnly[1], name: '' };
    return null;
}

/**
 * Parse aria snapshot to extract the picked element and optional parent context.
 * Returns { element, parent }.
 *
 * Single line:  `- button "Submit"` → element only
 * Nested:       `- listitem:\n  - checkbox "reading"` → element=checkbox, parent=listitem
 */
const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'checkbox', 'radio', 'textbox', 'combobox', 'switch',
    'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'option',
    'slider', 'spinbutton', 'searchbox', 'treeitem',
]);

function parseAriaSnapshot(snapshot: string): { element: AriaNode; parent?: AriaNode } | null {
    const lines = snapshot.split('\n').filter(l => l.trim() && l.trim() !== '-');
    if (!lines.length) return null;

    // Single-line snapshot: the element itself
    if (lines.length === 1) {
        const element = parseAriaLine(lines[0]);
        return element ? { element } : null;
    }

    const firstNode = parseAriaLine(lines[0]);
    if (!firstNode) return null;

    // Find first child line (deeper indentation)
    const parentIndent = lines[0].search(/\S/);
    for (let i = 1; i < lines.length; i++) {
        const indent = lines[i].search(/\S/);
        if (indent > parentIndent) {
            const child = parseAriaLine(lines[i]);
            if (child) {
                // If child is interactive (button, link, checkbox, etc.),
                // first line is a container/parent and child is the element.
                // If child is structural (generic, img, text, etc.),
                // first line IS the picked element — children are just DOM contents.
                if (INTERACTIVE_ROLES.has(child.role)) {
                    return { element: child, parent: firstNode };
                }
                return { element: firstNode };
            }
        }
    }

    // No children parsed — treat first line as the element
    return { element: firstNode };
}

// ─── JS Locator Parsing ──────────────────────────────────────────────

type ParsedLocator = {
    method: string;       // 'getByRole', 'getByText', 'getByLabel', etc.
    role?: string;        // only for getByRole
    name?: string;        // primary argument (role name, text, label, etc.)
};

/**
 * Parse a JS locator string to extract method, role, and name.
 * Handles chained locators by finding the last getBy* call.
 * e.g. `getByRole('button', { name: 'Submit' })` → { method: 'getByRole', role: 'button', name: 'Submit' }
 * e.g. `getByText('Hello')` → { method: 'getByText', name: 'Hello' }
 * e.g. `getByRole('listitem').filter(...).getByRole('button', { name: 'Delete' })` → last getByRole wins
 */
function parseJsLocator(locator: string): ParsedLocator {
    // Strip page. prefix and nth suffixes
    const s = locator
        .replace(/^page\./, '')
        .replace(/\.(first|last)\(\)$/, '')
        .replace(/\.nth\(\d+\)$/, '');

    // Find last getByRole (negative lookahead ensures no later getBy* call)
    // Use [^'"]+ to prevent matching across quote boundaries during backtracking
    const roleMatch = s.match(/getByRole\(['"]([^'"]+)['"](?:,\s*\{([^}]*)\})?\)(?!.*getBy)/);
    if (roleMatch) {
        const nameMatch = roleMatch[2]?.match(/name:\s*['"]([^'"]+)['"]/);
        return { method: 'getByRole', role: roleMatch[1], name: nameMatch?.[1] };
    }

    // Find last getBy* call (non-role)
    for (const method of ['getByText', 'getByLabel', 'getByPlaceholder', 'getByTestId', 'getByTitle', 'getByAltText']) {
        const re = new RegExp(`${method}\\(['"]([^'"]+)['"](?:,\\s*\\{[^}]*\\})?\\)(?!.*getBy)`);
        const m = s.match(re);
        if (m) return { method, name: m[1] };
    }

    // CSS/XPath locator
    if (/locator\(/.test(s)) return { method: 'locator' };

    return { method: 'unknown' };
}

/** Collapse whitespace (including non-breaking spaces) the way Playwright's text matchers do. */
function normalizeWhiteSpace(s: string): string {
    return s.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Derive the JS assertion for the picked element.
 * Priority: checked > value > URL-only link > text > visible.
 */
function deriveAssertion(info: ElementPickInfo, locator: string, ariaSnapshot?: string): string {
    const tag = info.tag;
    const inputType = info.attributes?.type?.toLowerCase() ?? '';

    // Checkbox/radio → checked assertion
    if (tag === 'input' && (inputType === 'checkbox' || inputType === 'radio') && info.checked !== undefined) {
        return info.checked
            ? `await expect(${locator}).toBeChecked();`
            : `await expect(${locator}).not.toBeChecked();`;
    }

    // Input/textarea/select → value assertion
    if ((tag === 'input' || tag === 'textarea' || tag === 'select') && info.value !== undefined)
        return `await expect(${locator}).toHaveValue('${info.value.replace(/'/g, "\\'")}');`;

    // Name: prefer the aria element name (full accessible name) over the JS locator name
    // (which may be a substring — Playwright's getByRole uses substring matching by default)
    const name = (ariaSnapshot ? parseAriaSnapshot(ariaSnapshot)?.element.name : '') || parseJsLocator(locator).name;

    // Link identified only by URL — assert visibility, not text content
    if (!name && ariaSnapshot && /\/url:\s*\S+/.test(ariaSnapshot))
        return `await expect(${locator}).toBeVisible();`;

    // Has text content → text assertion
    // Skip if locator is getByText — toContainText with the same text is redundant
    const text = info.text?.trim();
    if (text && !/\.getByText\(/.test(locator)) {
        // toContainText checks textContent, which can differ from the accessible name
        // (aria-hidden counters, visually hidden text, CSS content). If the name isn't in the
        // text, don't guess a value: suggest toBeVisible and let the user write the text.
        const content = normalizeWhiteSpace(info.textContent ?? text);
        const accessibleName = name ? normalizeWhiteSpace(name) : '';
        if (accessibleName && !content.includes(accessibleName)) return `await expect(${locator}).toBeVisible();`;
        const assertText = accessibleName || content;
        return `await expect(${locator}).toContainText('${assertText.replace(/'/g, "\\'")}');`;
    }

    return `await expect(${locator}).toBeVisible();`;
}

/**
 * Build a PickResultData from element info gathered by pickLocator().
 */
export function buildPickResult(info: ElementPickInfo, cdpLocator?: string | null, ariaSnapshot?: string): PickResultData {
    const jsLocator = cdpLocator ?? info.locator;
    const locator = `page.${jsLocator}`;

    // Extract snapshot ref from aria snapshot (e.g. [ref=e45] → "e45")
    const ref = ariaSnapshot?.match(/\[ref=(e\d+)\]/)?.[1];

    return {
        locator,
        jsExpression: `await page.${jsLocator}.highlight();`,
        assertJs: deriveAssertion(info, locator, ariaSnapshot),
        ref,
        details: {
            tag: info.tag,
            text: info.text,
            html: info.html,
            visible: info.visible,
            enabled: info.enabled,
            count: 1,
            attributes: info.attributes,
            box: info.box,
            value: info.value,
            checked: info.checked,
        },
    };
}
