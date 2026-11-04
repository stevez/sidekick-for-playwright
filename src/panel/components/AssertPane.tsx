import { useState } from 'react';
import { buildPickResult } from '@/lib/pick-info';
import { executeCommand } from '@/lib/bridge';
import { filterTypes, buildAssertion, buildSnapshotAssertion, parseAssertion, summarizeFailure } from '@/lib/assert-builder';
import { CrosshairIcon } from './Icons';
import type { ElementPickInfo } from '@/types';

interface AssertPaneProps {
    onInsert: (code: string) => void;
}

type Mode = 'locator' | 'snapshot';
type Fields = { locator: string; mode: Mode; type: string; arg: string; negate: boolean; snapshot: string };
type VerifyState = { status: 'idle' | 'running' | 'passed' | 'failed'; message?: string; full?: string };

const buttonClass = 'bg-(--bg-button) text-(--text-default) border border-solid border-(--border-button) rounded-[3px] py-1 px-3 font-[inherit] text-[12px] cursor-pointer hover:bg-(--bg-button-hover) disabled:opacity-50';
const inputClass = 'bg-(--bg-editor) text-(--text-default) border border-solid border-(--border-button) rounded-[3px] py-1 px-2 font-[inherit] text-[12px]';
const labelClass = 'text-[11px] text-(--text-dim)';

function assertionFor(f: Fields): string {
    return f.mode === 'snapshot'
        ? buildSnapshotAssertion(f.locator, f.snapshot, f.negate)
        : buildAssertion(f.locator, f.type, f.arg, f.negate);
}

/** Assert Builder: pick an element, choose a matcher, verify it on the live page, insert it into the script. */
export function AssertPane({ onInsert }: AssertPaneProps) {
    const [fields, setFields] = useState<Fields>({ locator: '', mode: 'locator', type: 'toBeVisible', arg: '', negate: false, snapshot: '' });
    const [element, setElement] = useState<{ tag?: string; inputType?: string }>({});
    const [assertion, setAssertion] = useState('');
    const [isPicking, setIsPicking] = useState(false);
    const [verify, setVerify] = useState<VerifyState>({ status: 'idle' });
    const [pickError, setPickError] = useState('');

    const types = filterTypes(element.tag, element.inputType);
    const typeDef = types.find(t => t.value === fields.type);

    /** Change builder fields and regenerate the assertion (manual edits to the assertion are replaced). */
    function update(patch: Partial<Fields>) {
        const next = { ...fields, ...patch };
        setFields(next);
        setAssertion(assertionFor(next));
        setVerify({ status: 'idle' });
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
            const snapshot = info.ariaSnapshot?.replace(/\s*\[(?:ref|cursor)=[^\]]*\]/g, '') ?? '';
            // Start from the picker's suggested assertion
            const parsed = parseAssertion(pick.assertJs ?? '');
            const next: Fields = {
                locator: pick.locator,
                mode: 'locator',
                type: parsed?.type ?? 'toBeVisible',
                arg: parsed?.arg ?? '',
                negate: parsed?.negate ?? false,
                snapshot,
            };
            setElement({ tag: info.tag, inputType: info.attributes?.type?.toLowerCase() });
            setFields(next);
            setAssertion(assertionFor(next));
            setVerify({ status: 'idle' });
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
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto p-2 text-[12px]" data-testid="assert-pane">
            {/* 1. Pick */}
            <section className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span>1</span>
                    <button
                        data-testid="assert-pick-btn"
                        className={isPicking ? 'picking' : ''}
                        title={isPicking ? 'Stop picking' : 'Pick element'}
                        onClick={handlePick}
                    ><CrosshairIcon /></button>
                    <span>Pick element</span>
                </div>
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
            <section className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <span>2</span>
                    <span>Assert using</span>
                    <label className="flex items-center gap-1">
                        <input type="radio" name="assert-mode" data-testid="assert-mode-locator" checked={fields.mode === 'locator'} onChange={() => update({ mode: 'locator' })} />
                        Locator
                    </label>
                    <label className="flex items-center gap-1">
                        <input type="radio" name="assert-mode" data-testid="assert-mode-snapshot" checked={fields.mode === 'snapshot'} onChange={() => update({ mode: 'snapshot' })} />
                        Snapshot
                    </label>
                    <label className="flex items-center gap-1">
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
            <section className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span>3</span>
                    <span>Verify</span>
                </div>
                <textarea
                    data-testid="assert-assertion"
                    className={inputClass}
                    rows={Math.max(2, Math.min(assertion.split('\n').length + 1, 12))}
                    placeholder="Assertion will appear here"
                    value={assertion}
                    onChange={e => { setAssertion(e.target.value); setVerify({ status: 'idle' }); }}
                />
                <div className="flex items-center gap-2">
                    <button data-testid="assert-verify" className={buttonClass} disabled={!assertion.trim() || verify.status === 'running'} onClick={handleVerify}>
                        {verify.status === 'running' ? 'Verifying...' : 'Verify'}
                    </button>
                    <button data-testid="assert-insert" className={buttonClass} disabled={!assertion.trim()} onClick={() => onInsert(assertion)}>
                        Insert
                    </button>
                    {verify.status === 'passed' && <span data-testid="assert-result" data-status="passed" className="text-(--color-success)">✓ Passed</span>}
                    {verify.status === 'failed' && <span data-testid="assert-result" data-status="failed" className="text-(--color-error)" title={verify.full}>✗ {verify.message}</span>}
                </div>
            </section>
        </div>
    );
}
