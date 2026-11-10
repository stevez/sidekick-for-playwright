const buttonClass = 'bg-(--bg-button) text-(--text-default) border border-solid border-(--border-button) rounded-[4px] py-1 px-3 font-[inherit] text-[12px] cursor-pointer hover:bg-(--bg-button-hover)';

/** Name, version and author */
function AboutDialog({ onClose }: { onClose: () => void }) {
    const version = chrome.runtime.getManifest().version;

    return (
        <div
            data-testid="about-dialog"
            className="fixed inset-0 bg-black/40 flex items-start justify-center pt-12 z-100"
            onClick={onClose}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
        >
            <div
                role="dialog"
                aria-labelledby="about-title"
                className="w-[min(320px,90%)] flex flex-col gap-3 p-4 bg-(--bg-toolbar) text-(--text-default) border border-solid border-(--border-primary) rounded-[6px] shadow-[0_4px_20px_rgba(0,0,0,0.3)] text-[13px]"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3">
                    <img src="/icons/icon48.png" width={40} height={40} alt="" />
                    <div className="flex flex-col">
                        <span id="about-title" className="font-semibold text-[15px]">Sidekick for Playwright</span>
                        <span data-testid="about-version" className="text-(--text-dim) text-[12px]">Version {version}</span>
                        <span className="text-(--text-dim) text-[12px]">by Steve Zhang</span>
                    </div>
                </div>
                <p className="m-0">Record, pick locators, and run or debug Playwright JavaScript in a side panel.</p>
                <div className="flex justify-end">
                    <button type="button" autoFocus className={buttonClass} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

export default AboutDialog;
