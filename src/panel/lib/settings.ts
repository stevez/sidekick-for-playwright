// ─── General Settings ───────────────────────────────────────────────────────

export type SidekickSettings = {
    commandTimeout: number,
};

const DEFAULT: SidekickSettings = { commandTimeout: 15000 };

export async function loadSettings(): Promise<SidekickSettings> {
    const stored = await chrome.storage.local.get(['commandTimeout']) as Partial<SidekickSettings>;
    return { ...DEFAULT, ...stored };
}
