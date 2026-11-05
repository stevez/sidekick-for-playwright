// ─── Video recorder ─────────────────────────────────────────────────────────
// The service worker streams JPEG frames from Playwright's page.screencast
// ('video-frame' messages, with the page's timestamp). Each frame is drawn onto a
// canvas and encoded with WebCodecs at its own timestamp, then muxed into a .webm by
// Mediabunny. Timing comes from the frames, so encoding keeps working while the panel
// is hidden (unlike canvas.captureStream, which only captures while the page renders).

import { BufferTarget, CanvasSource, Output, QUALITY_MEDIUM, WebMOutputFormat } from 'mediabunny';

export type VideoResult = { ok: true; blobUrl: string; duration: number; size: number } | { ok: false; error: string };

type Encoder = { output: Output<WebMOutputFormat, BufferTarget>; source: CanvasSource };

type Session = {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    encoder?: Encoder;
    firstTimestamp?: number;  // ms, the page clock of the first frame
    lastTime: number;         // seconds into the video of the last encoded frame
    queue: Promise<void>;
    error?: unknown;
    onMessage: (msg: { type?: string; data?: string; timestamp?: number }) => void;
};

let session: Session | null = null;

export function isVideoRecording(): boolean {
    return session !== null;
}

function decodeBase64(b64: string): Uint8Array<ArrayBuffer> {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function startEncoder(s: Session, width: number, height: number): Promise<Encoder> {
    s.canvas.width = width - width % 2; // encoders want even dimensions
    s.canvas.height = height - height % 2;
    const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
    const source = new CanvasSource(s.canvas, { codec: 'vp9', bitrate: QUALITY_MEDIUM });
    output.addVideoTrack(source);
    await output.start();
    return { output, source };
}

async function encodeFrame(s: Session, b64: string, timestamp: number) {
    const frame = await createImageBitmap(new Blob([decodeBase64(b64)], { type: 'image/jpeg' }));
    try {
        s.encoder ??= await startEncoder(s, frame.width, frame.height);
        s.firstTimestamp ??= timestamp;
        const time = Math.max((timestamp - s.firstTimestamp) / 1000, s.lastTime + 0.001); // keep timestamps increasing
        s.ctx.drawImage(frame, 0, 0, s.canvas.width, s.canvas.height);
        await s.encoder.source.add(time);
        s.lastTime = time;
    } finally {
        frame.close();
    }
}

export async function startVideo(takeOver = true): Promise<{ ok: boolean; error?: string }> {
    if (session) return { ok: false, error: 'Already recording' };
    if (typeof VideoEncoder === 'undefined') return { ok: false, error: 'Video encoding (WebCodecs) is not available in this browser' };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, error: 'Canvas not available' };
    const s: Session = { canvas, ctx, lastTime: 0, queue: Promise.resolve(), onMessage: () => {} };
    s.onMessage = msg => {
        if (msg?.type !== 'video-frame' || !msg.data || msg.timestamp === undefined) return;
        const { data, timestamp } = msg;
        // Encode in arrival order; decoding and encoding are async
        s.queue = s.queue.then(() => encodeFrame(s, data, timestamp)).catch(e => { s.error ??= e; });
    };
    chrome.runtime.onMessage.addListener(s.onMessage);
    session = s;
    const r = await chrome.runtime.sendMessage({ type: 'video-start' }).catch((e: unknown) => ({ ok: false, error: String(e) }));
    if (!r?.ok) {
        chrome.runtime.onMessage.removeListener(s.onMessage);
        session = null;
        // The service worker may still be recording for a panel that was closed: restart it here
        if (r?.error === 'Already recording' && takeOver) {
            await chrome.runtime.sendMessage({ type: 'video-stop' }).catch(() => {});
            return startVideo(false);
        }
    }
    return r ?? { ok: false, error: 'No response' };
}

export async function stopVideo(): Promise<VideoResult> {
    const s = session;
    if (!s) return { ok: false, error: 'Not recording' };
    session = null;
    const stoppedAt = Date.now();
    const r = await chrome.runtime.sendMessage({ type: 'video-stop' }).catch(() => undefined) as { duration?: number } | undefined;
    chrome.runtime.onMessage.removeListener(s.onMessage);
    await s.queue;
    const encoder = s.encoder;
    if (!encoder || s.firstTimestamp === undefined) return { ok: false, error: s.error ? `Video encoding failed: ${String(s.error)}` : 'No frames captured' };
    try {
        // Hold the last frame until the moment recording stopped, not just the last page change
        const end = (stoppedAt - s.firstTimestamp) / 1000;
        if (end > s.lastTime + 0.001) await encoder.source.add(end);
        await encoder.output.finalize();
    } catch (e) {
        await encoder.output.cancel().catch(() => {});
        return { ok: false, error: `Video encoding failed: ${String(e)}` };
    }
    const blob = new Blob([encoder.output.target.buffer!], { type: 'video/webm' });
    return { ok: true, blobUrl: URL.createObjectURL(blob), duration: r?.duration ?? 0, size: blob.size };
}

/** Save a recorded video through the browser's save dialog. */
export async function saveVideo(blobUrl: string): Promise<void> {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: `sidekick-recording-${timestamp}.webm`,
            types: [{ description: 'WebM video', accept: { 'video/webm': ['.webm'] } }],
        });
        const blob = await (await fetch(blobUrl)).blob();
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
    } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') console.error('Save video failed:', e);
    }
}
