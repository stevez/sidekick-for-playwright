import { useState, type ReactNode } from 'react';
import { highlightCode } from '@lezer/highlight';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { jsHighlightStyle } from '@/lib/codemirror-setup';
import { executeCommand } from '@/lib/bridge';
import { usePickActions } from './PickActionsContext';
import type { PickResultData } from '@/types';

/** JavaScript as syntax-highlighted spans, using the editor's colors
 *  (jsHighlightStyle's classes, whose styles the always-mounted editor installs) */
function highlightJs(code: string): ReactNode[] {
    const out: ReactNode[] = [];
    highlightCode(code, javascriptLanguage.parser.parse(code), jsHighlightStyle,
        (text, classes) => out.push(classes ? <span key={out.length} className={classes}>{text}</span> : text),
        () => out.push('\n'));
    return out;
}

const actionClass = 'bg-(--bg-button) text-(--text-default) border border-solid border-(--border-button) rounded-[4px] py-0.5 px-2.5 font-(family-name:--font-ui) text-[12px] cursor-pointer hover:bg-(--bg-button-hover) hover:border-(--color-accent)';

/** "button "Greet"" from the first line of the ARIA snapshot, else the tag and text */
function describe(pick: PickResultData): { role: string; name?: string } {
    const m = pick.ariaSnapshot?.match(/^-\s+([\w-]+)(?:\s+"((?:[^"\\]|\\.)*)")?/);
    if (m) return { role: m[1], name: m[2] };
    const text = pick.details?.text?.trim();
    return { role: `<${pick.details?.tag ?? 'element'}>`, name: text ? text.slice(0, 40) : undefined };
}

/** Result of the toolbar picker: the locator, ready to copy, with the element highlighted on hover */
export function PickResult({ pick }: { pick: PickResultData }) {
    const { openInAssert } = usePickActions();
    const [copied, setCopied] = useState(false);
    const { role, name } = describe(pick);

    async function copy() {
        await navigator.clipboard.writeText(pick.locator);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    }

    // Errors (e.g. the tab was detached) only mean there's nothing to highlight
    const highlight = () => { executeCommand(`await ${pick.locator}.highlight()`).catch(() => {}); };
    const hideHighlight = () => { executeCommand('await page.hideHighlight()').catch(() => {}); };

    // Plain key: value rows, like the rest of the console output (ObjectTree)
    return (
        <div data-type="pick-result" data-testid="pick-result">
            <div className="ot-row">
                <span className="ot-key">element</span><span className="ot-colon">: </span>
                <span>{role}{name !== undefined && ` "${name}"`}</span>
            </div>
            <div className="ot-row flex-wrap">
                <span className="ot-key">locator</span><span className="ot-colon">: </span>
                <span
                    data-testid="pick-locator"
                    className="min-w-0 break-all cursor-default hover:underline"
                    title="Hover to highlight the element on the page"
                    onMouseEnter={highlight}
                    onMouseLeave={hideHighlight}
                >{highlightJs(pick.locator)}</span>
            </div>
            <div className="flex gap-2 mt-1 mb-0.5">
                <button data-testid="pick-copy" className={actionClass} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
                <button data-testid="pick-open-assert" className={actionClass} onClick={() => openInAssert(pick)}>Open in Assert</button>
            </div>
        </div>
    );
}
