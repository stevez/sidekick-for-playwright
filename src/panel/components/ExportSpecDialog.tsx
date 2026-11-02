import { useState } from 'react';
import { buildSpec, specFileName, type SpecFormat } from '@/lib/export-spec';

interface ExportSpecDialogProps {
    script: string;
    defaultName: string;
    onClose: () => void;
    onError: (message: string) => void;
}

const FILE_TYPES: Record<SpecFormat, { description: string; accept: Record<string, string[]> }> = {
    ts: { description: 'TypeScript spec', accept: { 'text/typescript': ['.ts'] } },
    js: { description: 'JavaScript spec', accept: { 'text/javascript': ['.js'] } },
};

const buttonClass = 'bg-(--bg-button) text-(--text-default) border border-solid border-(--border-button) rounded-[3px] py-1 px-3 font-[inherit] text-[12px] cursor-pointer hover:bg-(--bg-button-hover) disabled:opacity-50';

/** Wrap the editor script in a Playwright test and save it as .spec.ts / .spec.js. */
function ExportSpecDialog({ script, defaultName, onClose, onError }: ExportSpecDialogProps) {
    const [testName, setTestName] = useState(defaultName);
    const [isSaving, setIsSaving] = useState(false);

    async function save(format: SpecFormat) {
        setIsSaving(true);
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: specFileName(testName, format),
                types: [FILE_TYPES[format]],
            });
            const writable = await fileHandle.createWritable();
            await writable.write(buildSpec(script, testName));
            await writable.close();
            onClose();
        } catch (e: unknown) {
            if (!(e instanceof Error && e.name === 'AbortError'))
                onError('Export failed: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div
            data-testid="export-spec-dialog"
            className="fixed inset-0 bg-black/40 flex items-start justify-center pt-12 z-100"
            onClick={onClose}
        >
            <form
                className="w-[min(360px,90%)] flex flex-col gap-2 p-3 bg-(--bg-toolbar) text-(--text-default) border border-solid border-(--border-primary) rounded-[4px] shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
                onSubmit={e => { e.preventDefault(); save('ts'); }}
            >
                <label className="flex flex-col gap-1 text-[12px]">
                    Test name
                    <input
                        data-testid="export-spec-name"
                        autoFocus
                        value={testName}
                        onChange={e => setTestName(e.target.value)}
                        className="bg-(--bg-editor) text-(--text-default) border border-solid border-(--border-button) rounded-[3px] py-1 px-2 font-[inherit] text-[12px]"
                    />
                </label>
                <div className="flex gap-2 justify-end">
                    <button type="button" className={buttonClass} onClick={onClose}>Cancel</button>
                    <button type="button" data-testid="export-spec-js" className={buttonClass} disabled={isSaving} onClick={() => save('js')}>Save .spec.js</button>
                    <button type="submit" data-testid="export-spec-ts" className={buttonClass} disabled={isSaving}>Save .spec.ts</button>
                </div>
            </form>
        </div>
    );
}

export default ExportSpecDialog;
