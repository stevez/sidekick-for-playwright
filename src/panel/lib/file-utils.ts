/** Local date and time for file names, e.g. 2026-11-11T20-15-03 */
export function fileTimestamp(d = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/** Save a data: or blob: URL through the browser's save dialog. Cancelling is not an error. */
export async function saveUrlAs(url: string, suggestedName: string, type: { description: string; accept: Record<string, string[]> }) {
    try {
        const handle = await window.showSaveFilePicker({ suggestedName, types: [type] });
        const blob = await (await fetch(url)).blob();
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
    } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') console.error('Save failed:', e);
    }
}

export async function saveToFile(dataUrl: string | undefined) {
    if (!dataUrl) return;
    const timestamp = fileTimestamp();
    if (dataUrl.startsWith('data:application/pdf'))
        await saveUrlAs(dataUrl, `page-${timestamp}.pdf`, { description: 'PDF documents', accept: { 'application/pdf': ['.pdf'] } });
    else
        await saveUrlAs(dataUrl, `screenshot-${timestamp}.png`, { description: 'PNG images', accept: { 'image/png': ['.png'] } });
}
