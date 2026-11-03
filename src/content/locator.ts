/**
 * Shared locator generation utilities.
 * Used by both picker.ts and recorder.ts content scripts.
 * Vite inlines this into each content script bundle — no runtime module loading.
 */

// ─── Implicit ARIA roles ─────────────────────────────────────────────────

export const IMPLICIT_ROLES: Record<string, string | ((el: Element) => string | null)> = {
    A: (el) => el.hasAttribute('href') ? 'link' : null,
    BUTTON: 'button',
    H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', H5: 'heading', H6: 'heading',
    INPUT: (el) => {
        const type = (el as HTMLInputElement).type.toLowerCase();
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (type === 'submit' || type === 'reset' || type === 'button') return 'button';
        if (type === 'hidden') return null;
        return 'textbox';
    },
    TEXTAREA: 'textbox',
    SELECT: 'combobox',
    IMG: 'img',
    NAV: 'navigation',
    MAIN: 'main',
    HEADER: 'banner',
    FOOTER: 'contentinfo',
    P: 'paragraph',
    UL: 'list', OL: 'list',
    LI: 'listitem',
    TABLE: 'table',
    TR: 'row',
    TH: 'columnheader',
    TD: 'cell',
    FORM: 'form',
    DIALOG: 'dialog',
    ARTICLE: 'article',
};

export function getImplicitRole(el: Element): string | null {
    const explicit = el.getAttribute('role');
    if (explicit && explicit !== 'none' && explicit !== 'presentation') return explicit;
    const entry = IMPLICIT_ROLES[el.tagName];
    if (!entry) return null;
    return typeof entry === 'function' ? entry(el) : entry;
}

// ─── Accessible name ─────────────────────────────────────────────────────

/**
 * Name computation context.
 *
 * `full: true` computes Playwright's accessible name. `full: false` (the
 * recorder name) computes the same name but stops at the first decorative
 * part — a `role="note"` descendant (e.g. MS Forms' "Required to answer" red
 * star) or a hidden `aria-labelledby` target (e.g. MS Forms' "Single line
 * text." hint). The recorder name is therefore always a prefix of Playwright's
 * name, so a non-exact `getByRole(role, { name })` still matches it.
 */
interface NameCtx {
    full: boolean;
    /** Set once a decorative part is reached in prefix mode — stop accumulating. */
    truncated: boolean;
}

const newNameCtx = (full = false): NameCtx => ({ full, truncated: false });

/** Playwright's asFlatString: collapse whitespace except nbsp, drop zero-width space / soft hyphen, trim. */
function asFlatString(s: string): string {
    return s.split('\u00A0')
        .map(chunk => chunk.replace(/\r\n/g, '\n').replace(/[\u200b\u00ad]/g, '').replace(/\s\s*/g, ' '))
        .join('\u00A0')
        .trim();
}

/**
 * Compute accumulated text from an element's children, mirroring Playwright's
 * innerAccumulatedElementText (packages/injected/src/roleUtils.ts). For each
 * element child, use its accessible name (respecting aria-label etc.) rather
 * than raw textContent. Wrap a child's contribution with spaces only when the
 * child has `display !== 'inline'` (or is <br>) — matches Playwright's
 * "SPEC DIFFERENCE" behavior where inline elements do not add a space.
 */
function accumulatedText(el: Element, exclude?: Element, ctx: NameCtx = newNameCtx()): string {
    return asFlatString(accumulatedRaw(el, exclude, ctx));
}

/**
 * accumulatedText without normalization. Playwright flattens whitespace once,
 * on the final name — flattening each level would trim an nbsp at the edge of
 * a nested span (MS Forms `<span>Application CI:&nbsp;</span>`) that Playwright keeps.
 */
function accumulatedRaw(el: Element, exclude: Element | undefined, ctx: NameCtx): string {
    const tokens: string[] = [];
    for (const child of el.childNodes) {
        if (ctx.truncated) break;
        if (exclude && child === exclude) continue;
        if (child.nodeType === Node.TEXT_NODE) {
            tokens.push(child.textContent || '');
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const childEl = child as Element;
            // Skip aria-hidden descendants (Playwright excludes them).
            if (childEl.getAttribute('aria-hidden') === 'true') continue;
            // role="note" is supplementary content (help hints, required
            // indicators). Playwright includes it; the recorder name stops here.
            if (!ctx.full && childEl.getAttribute('role') === 'note') {
                ctx.truncated = true;
                break;
            }
            let contribution: string;
            if (exclude && childEl.contains(exclude)) {
                contribution = accumulatedRaw(childEl, exclude, ctx);
            } else {
                const name = getAccessibleName(childEl, ctx);
                contribution = name || accumulatedRaw(childEl, undefined, ctx);
            }
            // Wrap with whitespace only when display is not inline (or <br>).
            // Matches Playwright's algorithm — inline elements concatenate
            // without added whitespace (e.g. MS Forms `<span>Application Name
            // </span><span role="note" aria-label="Required">` → "Application
            // NameRequired", not "Application Name Required").
            const display = getComputedStyle(childEl).display || 'inline';
            if (display !== 'inline' || childEl.nodeName === 'BR')
                contribution = ' ' + contribution + ' ';
            tokens.push(contribution);
        }
    }
    return tokens.join('');
}

/**
 * The name the recorder emits: Playwright's accessible name up to its first
 * decorative part (see NameCtx). Pass a context to compute Playwright's full
 * name instead — see getPlaywrightName().
 */
export function getAccessibleName(el: Element, ctx: NameCtx = newNameCtx()): string {
    // aria-labelledby (highest priority per ARIA spec)
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
        const parts: string[] = [];
        for (const id of labelledBy.split(/\s+/)) {
            if (ctx.truncated) break;
            const ref = document.getElementById(id);
            if (!ref) continue;
            // Playwright includes directly-referenced hidden targets (accname
            // spec); the recorder name stops at them.
            const hidden = ref.getAttribute('aria-hidden') === 'true' || getComputedStyle(ref).display === 'none';
            if (hidden && !ctx.full) {
                ctx.truncated = true;
                break;
            }
            const text = accumulatedText(ref, undefined, ctx);
            if (text) parts.push(text);
        }
        if (parts.length) return parts.join(' ');
    }

    // aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    // For inputs: associated <label>
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        const label = getLabel(el, ctx);
        if (label) return label;
    }

    // For roles that get name from content (ARIA "name from content" roles)
    const role = getImplicitRole(el);
    const NAME_FROM_CONTENT = new Set([
        'button', 'link', 'heading', 'tab', 'menuitem', 'menuitemcheckbox',
        'menuitemradio', 'option', 'radio', 'checkbox', 'switch', 'cell',
        'columnheader', 'rowheader', 'tooltip', 'treeitem',
    ]);
    if (role && NAME_FROM_CONTENT.has(role)) {
        const text = accumulatedText(el, undefined, ctx);
        if (text) return text;
    }

    // alt for images
    if (el.tagName === 'IMG') {
        const alt = el.getAttribute('alt');
        if (alt) return alt.trim();
    }

    // title attribute (fallback per ARIA name computation spec)
    const title = el.getAttribute('title');
    if (title) return title.trim();

    return '';
}

/** Playwright's full accessible name (includes role="note" and hidden labelledby text). */
export function getPlaywrightName(el: Element): string {
    return getAccessibleName(el, newNameCtx(true));
}

export function getLabel(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, ctx: NameCtx = newNameCtx()): string {
    // Explicit label via for attribute
    if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label) return accumulatedText(label, el, ctx);
    }
    // Implicit label (ancestor)
    const parentLabel = el.closest('label');
    if (parentLabel) {
        return accumulatedText(parentLabel, el, ctx);
    }
    // Informal associations (e.g. preceding table cell) are excluded here because
    // getByRole/getByLabel can't resolve them.
    return '';
}

/** Collapse whitespace sequences (incl. newlines) into a single space, then trim. */
function normalizeText(s: string): string {
    return (s || '').replace(/\s+/g, ' ').trim();
}

// ─── Ancestor context disambiguation ─────────────────────────────────────

/** Container roles suitable for ancestor-context disambiguation. */
const CONTAINER_ROLES = new Set(['listitem', 'row', 'article', 'group']);

/**
 * Find distinctive text in an ancestor that doesn't come from the excluded element's subtree.
 * Returns text from the first child subtree that doesn't contain the excluded element,
 * recursing into wrappers that do contain it. This ensures the returned text is a
 * contiguous substring of the ancestor's full textContent (needed for hasText matching).
 */
function getContextText(ancestor: Element, exclude: Element): string {
    function findText(node: Node): string {
        for (const child of node.childNodes) {
            if (child === exclude) continue;
            if (child.nodeType === Node.ELEMENT_NODE && (child as Element).contains(exclude)) {
                // This subtree contains the target — recurse to find non-target siblings
                const inner = findText(child);
                if (inner) return inner;
                continue;
            }
            const text = normalizeText(child.textContent || '');
            if (text) return text;
        }
        return '';
    }
    return findText(ancestor);
}

/** Walk up from el to find nearest ancestor with a container role. */
function findContainerAncestor(el: Element): { ancestor: Element; role: string } | null {
    let current = el.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
        const role = getImplicitRole(current);
        if (role && CONTAINER_ROLES.has(role)) return { ancestor: current, role };
        current = current.parentElement;
    }
    return null;
}

/**
 * Try to disambiguate using ancestor context.
 * Returns a chained locator like:
 *   getByRole('listitem').filter({ hasText: 'reading' }).getByRole('button', { name: 'Delete' })
 * or null if ancestor context doesn't produce a unique result.
 */
function tryAncestorContext(el: Element, role: string, name: string, matches: Element[]): string | null {
    const container = findContainerAncestor(el);
    if (!container) return null;

    const contextText = getContextText(container.ancestor, el);
    if (!contextText) return null;

    // Verify uniqueness: only one match's container ancestor should contain this text
    let count = 0;
    for (const match of matches) {
        const mc = findContainerAncestor(match);
        if (!mc || mc.role !== container.role) continue;
        if ((mc.ancestor.textContent || '').includes(contextText)) {
            count++;
            if (count > 1) return null;
        }
    }
    if (count !== 1) return null;

    return `getByRole(${escapeString(container.role)}).filter({ hasText: ${escapeString(contextText)} }).getByRole(${escapeString(role)}, { name: ${escapeString(name)} })`;
}

// ─── Locator disambiguation ─────────────────────────────────────────────

export function findByRoleAndName(role: string, name: string): Element[] {
    const matches: Element[] = [];
    for (const el of document.querySelectorAll('*')) {
        if (getImplicitRole(el) === role && getAccessibleName(el) === name
            && (el as HTMLElement).checkVisibility?.() !== false)
            matches.push(el);
    }
    return matches;
}

/** Like findByRoleAndName but includes hidden elements (for hover detection). */
export function findAllByRoleAndName(role: string, name: string): Element[] {
    const matches: Element[] = [];
    for (const el of document.querySelectorAll('*')) {
        if (getImplicitRole(el) === role && getAccessibleName(el) === name)
            matches.push(el);
    }
    return matches;
}

/**
 * Visible elements a non-exact `getByRole(role, { name })` matches: Playwright's
 * full name contains `name` (case-insensitive, whitespace-normalized).
 */
export function findByRoleAndNameSubstring(role: string, name: string): Element[] {
    const wanted = normalizeText(name).toLowerCase();
    const matches: Element[] = [];
    for (const el of document.querySelectorAll('*')) {
        if (getImplicitRole(el) === role
            && normalizeText(getPlaywrightName(el)).toLowerCase().includes(wanted)
            && (el as HTMLElement).checkVisibility?.() !== false)
            matches.push(el);
    }
    return matches;
}

/**
 * Find visible elements matching Playwright's `getByText(text, { exact: true })`:
 * the element's whitespace-normalized text equals `text` (so split text like
 * `Select <b>your</b> answer` matches), and it is the innermost such element —
 * wrapping ancestors with the same text are not matches.
 */
export function findByText(text: string): Element[] {
    const wanted = normalizeText(text);
    const matches: Element[] = [];
    for (const el of document.body.querySelectorAll('*')) {
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
        if (normalizeText(el.textContent || '') !== wanted) continue;
        if ([...el.children].some(c => normalizeText(c.textContent || '') === wanted)) continue;
        if ((el as HTMLElement).checkVisibility?.() === false) continue;
        matches.push(el);
    }
    return matches;
}

/** Find the nearest :hover ancestor (for recording hover before click). */
export function findHoverAncestor(el: Element): Element | null {
    let ancestor = el.parentElement;
    while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
        if (ancestor.matches(':hover')) return ancestor;
        ancestor = ancestor.parentElement;
    }
    return null;
}

/**
 * Check if element is revealed by a :hover CSS rule.
 * Scans stylesheets for rules like `.parent:hover .child { display: inline-block }`.
 * At click time the ancestor IS hovered, so el.matches() works against :hover selectors.
 */
export function isHoverRevealed(el: Element): boolean {
    for (const sheet of document.styleSheets) {
        try {
            for (const rule of sheet.cssRules) {
                if (!(rule instanceof CSSStyleRule)) continue;
                if (!rule.selectorText.includes(':hover')) continue;
                const s = rule.style;
                const reveals = (s.display && s.display !== 'none') ||
                    s.visibility === 'visible' ||
                    (s.opacity && s.opacity !== '0');
                if (!reveals) continue;
                try { if (el.matches(rule.selectorText)) return true; } catch { /* invalid selector */ }
            }
        } catch { /* cross-origin stylesheet */ }
    }
    return false;
}

// ─── Locator generation ──────────────────────────────────────────────────

export function escapeString(s: string): string {
    if (!s.includes("'")) return `'${s}'`;
    if (!s.includes('"')) return `"${s}"`;
    return `'${s.replace(/'/g, "\\'")}'`;
}

export function generateLocator(el: Element): string {
    // 1. Test ID
    const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
    if (testId) return `getByTestId(${escapeString(testId)})`;

    // 2. Role + accessible name
    const role = getImplicitRole(el);
    const name = getAccessibleName(el);
    if (role && name) {
        // Recorder name is a truncated prefix of Playwright's name (decorative
        // role="note" / hidden labelledby text dropped) — emit it without
        // `exact` so Playwright substring-matches, and disambiguate among the
        // same substring matches Playwright will see.
        if (name !== getPlaywrightName(el)) {
            const base = `getByRole(${escapeString(role)}, { name: ${escapeString(name)} })`;
            const matches = findByRoleAndNameSubstring(role, name);
            const idx = matches.indexOf(el);
            if (matches.length <= 1 || idx < 0) return base;
            return idx === 0 ? base + '.first()' : base + `.nth(${idx})`;
        }
        // Disambiguate when multiple elements share same role + name
        const matches = findByRoleAndName(role, name);
        if (matches.length > 1) {
            // Try ancestor context first (readable chained locators)
            const ancestorLocator = tryAncestorContext(el, role, name, matches);
            if (ancestorLocator) return ancestorLocator;
            // Fallback to nth-based disambiguation
            const base = `getByRole(${escapeString(role)}, { name: ${escapeString(name)}, exact: true })`;
            const idx = matches.indexOf(el);
            return idx === 0 ? base + '.first()' : base + `.nth(${idx})`;
        }
        return `getByRole(${escapeString(role)}, { name: ${escapeString(name)} })`;
    }

    // 3. Label (for form elements)
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        const label = getLabel(el);
        if (label) return `getByLabel(${escapeString(label)})`;
    }

    // 4. Placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return `getByPlaceholder(${escapeString(placeholder)})`;

    // 5. Alt text
    const alt = el.getAttribute('alt');
    if (alt && ['IMG', 'APPLET', 'AREA', 'INPUT'].includes(el.tagName))
        return `getByAltText(${escapeString(alt)})`;

    // 6. Title
    const title = el.getAttribute('title');
    if (title) return `getByTitle(${escapeString(title)})`;

    // 7. Text content — use exact matching for full text, substring for long text
    // Skip for <select>: textContent is concatenated option texts, not useful for locating.
    const text = (el.textContent || '').trim();
    if (text && el.tagName !== 'SELECT') {
        if (text.length <= 80) {
            const base = `getByText(${escapeString(text)}, { exact: true })`;
            // Disambiguate when the same text appears in multiple places
            // (e.g. MS Forms uses "Select your answer" as placeholder for every dropdown).
            const matches = findByText(text);
            const idx = matches.indexOf(el);
            if (matches.length <= 1) return base;
            // Only emit when the index is reliable; otherwise fall through to
            // the next strategy rather than recording an ambiguous locator.
            if (idx >= 0) return idx === 0 ? `${base}.first()` : `${base}.nth(${idx})`;
        } else {
            const snippet = text.slice(0, 50).replace(/\s+\S*$/, '');
            if (snippet) return `getByText(${escapeString(snippet)})`;
        }
    }

    // 8. Role without name — only when unique on the page
    if (role) {
        const allWithRole = [...document.querySelectorAll('*')].filter(
            e => getImplicitRole(e) === role && (!e.checkVisibility || e.checkVisibility()),
        );
        if (allWithRole.length === 1) return `getByRole(${escapeString(role)})`;
    }

    // 9. CSS fallback — use nth-of-type for deterministic targeting
    return `locator(${escapeString(buildCssSelector(el))})`;
}

// ─── Element classification ─────────────────────────────────────────────

/** Check if element is a text-entry field */
export function isTextField(el: Element): boolean {
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLInputElement) {
        const type = el.type.toLowerCase();
        return !['checkbox', 'radio', 'submit', 'reset', 'button', 'hidden', 'file', 'image', 'range', 'color'].includes(type);
    }
    // contenteditable
    if (el.getAttribute('contenteditable') === 'true') return true;
    return false;
}

/** Check if element is a checkbox or radio */
export function isCheckable(el: Element): boolean {
    return el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');
}

// ─── Command building ───────────────────────────────────────────────────

/** Build the Playwright JS line for a recorder action */
export function buildCommand(action: string, el: Element, opts?: {
    value?: string;
    key?: string;
    option?: string;
}): string | null {
    const loc = `page.${generateLocator(el)}`;

    switch (action) {
        case 'hover':
            return `await ${loc}.hover();`;
        case 'click':
            return `await ${loc}.click();`;
        case 'fill':
            return `await ${loc}.fill(${escapeString(opts?.value ?? '')});`;
        case 'check':
            return `await ${loc}.check();`;
        case 'uncheck':
            return `await ${loc}.uncheck();`;
        case 'select':
            return `await ${loc}.selectOption(${escapeString(opts?.option ?? '')});`;
        case 'press':
            return `await ${loc}.press(${escapeString(opts?.key ?? '')});`;
        default:
            return null;
    }
}

// ─── CSS selector ───────────────────────────────────────────────────────

export function buildCssSelector(el: Element): string {
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${CSS.escape(el.id)}`;
    const classes = [...el.classList].slice(0, 2).map(c => '.' + CSS.escape(c)).join('');
    if (classes) return `${tag}${classes}`;

    // Bare tag — build a unique path from the nearest identifiable ancestor
    let current: Element | null = el;
    const parts: string[] = [];
    while (current && current !== document.body && current !== document.documentElement) {
        const t = current.tagName.toLowerCase();
        if (current.id) {
            parts.unshift(`${t}#${CSS.escape(current.id)}`);
            break;
        }
        const cls = [...current.classList].slice(0, 2).map(c => '.' + CSS.escape(c)).join('');
        if (cls) {
            parts.unshift(`${t}${cls}`);
            break;
        }
        // Use nth-of-type if siblings share the tag
        const parent = current.parentElement;
        if (parent) {
            const siblings = [...parent.querySelectorAll(`:scope > ${t}`)];
            parts.unshift(siblings.length > 1
                ? `${t}:nth-of-type(${siblings.indexOf(current) + 1})`
                : t);
        } else {
            parts.unshift(t);
        }
        current = current.parentElement;
    }
    return parts.join(' > ');
}
