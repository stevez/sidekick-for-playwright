import { useEffect, useState, type ReactNode } from 'react';
import { buildPickResult } from '@/lib/pick-info';
import { executeCommand } from '@/lib/bridge';
import { filterTypes, buildAssertion, buildSnapshotAssertion, parseAssertion, summarizeFailure } from '@/lib/assert-builder';
import { CrosshairIcon } from './Icons';
import type { ElementPickInfo, PickResultData } from '@/types';

interface AssertPaneProps {
    /** Element sent from the console's Pick card (a new object on every send) */
    incoming?: { pick: PickResultData } | null;
}

type Mode = 'locator' | 'snapshot';
type Fields = { locator: string; mode: Mode; type: string; arg: string; negate: boolean; snapshot: string };
type VerifyState = { status: 'idle' | 'running' | 'passed' | 'failed'; message?: string; full?: string };

const buttonClass = 'bg-(--bg-button) text-(--text-default) border border-solid border-(--border-button) rounded-[4px] py-1 px-3 font-sans text-[12px] cursor-pointer hover:bg-(--bg-button-hover) disabled:opacity-50 disabled:cursor-default';
// Verify result box; the status adds its color (tinted from --color-success / --color-error)
const resultClass = 'py-1.5 px-2 rounded-[4px] border border-solid font-sans text-[12px] break-words';
const inputClass = 'bg-(--bg-editor) text-(--text-default) border border-solid border-(--border-button) rounded-[4px] py-1 px-2 font-[inherit] text-[12px] focus:outline-none focus:border-(--color-splitter-handle-hover)';
// UI text (labels, titles) uses the sans font, so it stands apart from the monospace code
const labelClass = 'font-sans text-[11px] text-(--text-dim)';
const optionClass = 'flex items-center gap-1 font-sans cursor-pointer accent-(--color-run-bg)';
const sectionClass = 'flex flex-col gap-1.5 p-2 rounded-[4px] border border-solid border-(--border-primary) bg-(--bg-toolbar)';

/** Numbered step heading: green badge plus a bold sans-serif title */
function StepTitle({ step, title, children }: { step: number; title: string; children?: ReactNode }) {
    return (
        <div className="flex items-center gap-2 min-h-6">
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-(--color-run-bg) text-white font-sans text-[11px] font-bold shrink-0">{step}</span>
            <span className="font-sans text-[13px] font-semibold">{title}</span>
            {children}
        </div>
    );
}

function assertionFor(f: Fields): string {
    return f.mode === 'snapshot'
        ? buildSnapshotAssertion(f.locator, f.snapshot, f.negate)
        : buildAssertion(f.locator, f.type, f.arg, f.negate);
}

/** Assert Builder: pick an element, choose a matcher, verify it on the live page, insert it into the script. */
export function AssertPane({ incoming }: AssertPaneProps) {
    const [fields, setFields] = useState<Fields>({ locator: '', mode: 'locator', type: 'toBeVisible', arg: '', negate: false, snapshot: '' });
    const [element, setElement] = useState<{ tag?: string; inputType?: string }>({});
    const [assertion, setAssertion] = useState('');
    const [isPicking, setIsPicking] = useState(false);
    const [verify, setVerify] = useState<VerifyState>({ status: 'idle' });
    const [pickError, setPickError] = useState('');
    const [copied, setCopied] = useState(false);

    const types = filterTypes(element.tag, element.inputType);
    const typeDef = types.find(t => t.value === fields.type);

    /** Change builder fields and regenerate the assertion (manual edits to the assertion are replaced). */
    function update(patch: Partial<Fields>) {
        const next = { ...fields, ...patch };
        setFields(next);
        setAssertion(assertionFor(next));
        setVerify({ status: 'idle' });
    }

    /** Fill the builder from a picked element, starting from the picker's suggested assertion */
    function applyPick(pick: PickResultData) {
        const parsed = parseAssertion(pick.assertJs ?? '');
        const next: Fields = {
            locator: pick.locator,
            mode: 'locator',
            type: parsed?.type ?? 'toBeVisible',
            arg: parsed?.arg ?? '',
            negate: parsed?.negate ?? false,
            snapshot: pick.ariaSnapshot ?? '',
        };
        setElement({ tag: pick.details?.tag, inputType: pick.details?.attributes?.type?.toLowerCase() });
        setFields(next);
        setAssertion(assertionFor(next));
        setVerify({ status: 'idle' });
        setPickError('');
    }

    useEffect(() => {
        if (incoming) applyPick(incoming.pick);
    }, [incoming]);

    async function copyAssertion() {
        await navigator.clipboard.writeText(assertion);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    }

    async function handlePick() {
        if (isPicking) {
            setIsPicking(false);
            await chrome.runtime.sendMessage({ type: 'pick-cancel' }).catch(e => console.debug('[sidekick] pick-cancel:', e));
            return;
        }
        setIsPicking(true);
        setPickError('');
        try {
            const result = await chrome.runtime.sendMessage({ type: 'pick' }) as { ok: boolean; info?: ElementPickInfo & { ariaSnapshot?: string }; error?: string };
            if (!result?.ok || !result.info) {
                if (result?.error !== 'cancelled') setPickError(`Pick failed: ${result?.error ?? 'unknown error'}`);
                return;
            }
            const info = result.info;
            const pick = buildPickResult(info, info.locator, info.ariaSnapshot);
            pick.ariaSnapshot = info.ariaSnapshot?.replace(/\s*\[(?:ref|cursor)=[^\]]*\]/g, '');
            applyPick(pick);
        } catch (e) {
            setPickError(`Pick failed: ${String(e)}`);
        } finally {
            setIsPicking(false);
        }
    }

    async function handleVerify() {
        if (!assertion.trim()) return;
        setVerify({ status: 'running' });
        const r = await executeCommand(assertion);
        setVerify(r.isError
            ? { status: 'failed', message: summarizeFailure(r.text), full: r.text }
            : { status: 'passed' });
    }

    return (
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-2 text-[12px]" data-testid="assert-pane">
            {/* 1. Pick */}
            <section className={sectionClass}>
                <StepTitle step={1} title="Pick element">
                    <button
                        data-testid="assert-pick-btn"
                        className={`${buttonClass} ml-auto flex items-center gap-1 py-0.5 px-2 ${isPicking ? 'picking bg-(--bg-run-line) text-(--color-snapshot) border-(--color-snapshot)' : ''}`}
                        title={isPicking ? 'Stop picking' : 'Pick element'}
                        onClick={handlePick}
                    ><CrosshairIcon />{isPicking ? 'Picking…' : 'Pick'}</button>
                </StepTitle>
                {pickError && <div className="text-(--color-error)" data-testid="assert-pick-error">{pickError}</div>}
                <label className={labelClass} htmlFor="assert-locator">Locator</label>
                <input
                    id="assert-locator"
                    data-testid="assert-locator"
                    className={inputClass}
                    placeholder="Pick an element or type a locator"
                    value={fields.locator}
                    onChange={e => update({ locator: e.target.value })}
                />
                <label className={labelClass} htmlFor="assert-aria">ARIA snapshot</label>
                <textarea
                    id="assert-aria"
                    data-testid="assert-aria"
                    className={inputClass}
                    rows={4}
                    readOnly
                    placeholder="Pick an element to see its ARIA snapshot"
                    value={fields.snapshot}
                />
            </section>

            {/* 2. Assert using */}
            <section className={sectionClass}>
                <StepTitle step={2} title="Assert using" />
                <div className="flex items-center gap-3">
                    <label className={optionClass}>
                        <input type="radio" name="assert-mode" data-testid="assert-mode-locator" checked={fields.mode === 'locator'} onChange={() => update({ mode: 'locator' })} />
                        Locator
                    </label>
                    <label className={optionClass}>
                        <input type="radio" name="assert-mode" data-testid="assert-mode-snapshot" checked={fields.mode === 'snapshot'} onChange={() => update({ mode: 'snapshot' })} />
                        Snapshot
                    </label>
                    <label className={`${optionClass} ml-auto`}>
                        <input type="checkbox" data-testid="assert-negate" checked={fields.negate} onChange={e => update({ negate: e.target.checked })} />
                        Not
                    </label>
                </div>
                {fields.mode === 'locator' && (
                    <div className="flex items-center gap-2">
                        <select
                            data-testid="assert-type"
                            className={inputClass}
                            value={fields.type}
                            onChange={e => update({ type: e.target.value, arg: '' })}
                        >
                            {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        {typeDef?.needsArg && (
                            <input
                                data-testid="assert-arg"
                                className={`${inputClass} flex-1 min-w-0`}
                                placeholder={typeDef.argType === 'pair' ? 'attribute, value' : typeDef.argType === 'number' ? 'Count' : 'Expected value'}
                                value={fields.arg}
                                onChange={e => update({ arg: e.target.value })}
                            />
                        )}
                    </div>
                )}
            </section>

            {/* 3. Verify and insert */}
            <section className={sectionClass}>
                <StepTitle step={3} title="Verify and copy" />
                <textarea
                    data-testid="assert-assertion"
                    className={inputClass}
                    rows={Math.max(2, Math.min(assertion.split('\n').length + 1, 12))}
                    placeholder="Assertion will appear here"
                    value={assertion}
                    onChange={e => { setAssertion(e.target.value); setVerify({ status: 'idle' }); }}
                />
                {verify.status === 'passed' && (
                    <div data-testid="assert-result" data-status="passed" className={`${resultClass} font-semibold text-(--color-success) border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]`}>
                        ✓ Passed
                    </div>
                )}
                {verify.status === 'failed' && (
                    <div data-testid="assert-result" data-status="failed" className={`${resultClass} text-(--color-error) border-[color-mix(in_srgb,var(--color-error)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)]`}>
                        <div className="font-semibold">✗ {verify.message}</div>
                        {verify.full && verify.full !== verify.message && (
                            <details className="mt-1 text-(--text-default)">
                                <summary className="cursor-pointer text-(--text-dim)">Full error</summary>
                                <pre className="mt-1 m-0 whitespace-pre-wrap break-words font-[inherit] text-[11px]">{verify.full}</pre>
                            </details>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button data-testid="assert-verify" className={buttonClass} disabled={!assertion.trim() || verify.status === 'running'} onClick={handleVerify}>
                        {verify.status === 'running' ? 'Verifying...' : 'Verify'}
                    </button>
                    <button data-testid="assert-copy" className={buttonClass} disabled={!assertion.trim()} onClick={copyAssertion}>
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            </section>
        </div>
    );
}
