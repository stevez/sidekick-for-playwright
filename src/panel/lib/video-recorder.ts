// ─── Video recorder ─────────────────────────────────────────────────────────
// The service worker streams JPEG frames from Playwright's page.screencast
// ('video-frame' messages, with the page's timestamp). Each frame is drawn onto a
// canvas and encoded with WebCodecs at its own timestamp, then muxed into a .webm by
// Mediabunny. Timing comes from the frames, so encoding keeps working while the panel
// is hidden (unlike canvas.captureStream, which only captures while the page renders).
// Output is an H.264 MP4 (plays everywhere, iPhone included); WebM/VP9 if the browser
// can't encode H.264.

import { BufferTarget, CanvasSource, canEncodeVideo, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat } from 'mediabunny';
import { fileTimestamp, saveUrlAs } from './file-utils';

export type VideoResult = { ok: true; blobUrl: string; duration: number; size: number } | { ok: false; error: string };

type Container = 'mp4' | 'webm';
type Encoder = { output: Output<Mp4OutputFormat | WebMOutputFormat, BufferTarget>; source: CanvasSource; container: Container };

const MIME: Record<Container, string> = { mp4: 'video/mp4', webm: 'video/webm' };

/** The container of each recorded blob URL, for the file name when saving. */
const containers = new Map<string, Container>();

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
    const size = { width: s.canvas.width, height: s.canvas.height, bitrate: QUALITY_HIGH };
    const container: Container = await canEncodeVideo('avc', size) ? 'mp4' : 'webm';
    const format = container === 'mp4'
        ? new Mp4OutputFormat({ fastStart: 'in-memory' }) // index at the front, so players can start before the end
        : new WebMOutputFormat();
    const output = new Output({ format, target: new BufferTarget() });
    const source = new CanvasSource(s.canvas, { codec: container === 'mp4' ? 'avc' : 'vp9', bitrate: QUALITY_HIGH });
    output.addVideoTrack(source);
    await output.start();
    return { output, source, container };
}

/** Draw the frame scaled to fit the canvas, keeping its aspect ratio. The encoder's size is
 *  fixed by the first frame, so a viewport resize mid-recording is letterboxed, not stretched. */
function drawFitted(s: Session, frame: ImageBitmap) {
    const { width, height } = s.canvas;
    const scale = Math.min(width / frame.width, height / frame.height);
    const w = frame.width * scale, h = frame.height * scale;
    if (w < width || h < height) {
        s.ctx.fillStyle = '#000';
        s.ctx.fillRect(0, 0, width, height);
    }
    s.ctx.drawImage(frame, (width - w) / 2, (height - h) / 2, w, h);
}

async function encodeFrame(s: Session, b64: string, timestamp: number) {
    const frame = await createImageBitmap(new Blob([decodeBase64(b64)], { type: 'image/jpeg' }));
    try {
        s.encoder ??= await startEncoder(s, frame.width, frame.height);
        s.firstTimestamp ??= timestamp;
        const time = Math.max((timestamp - s.firstTimestamp) / 1000, s.lastTime + 0.001); // keep timestamps increasing
        drawFitted(s, frame);
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
    const blob = new Blob([encoder.output.target.buffer!], { type: MIME[encoder.container] });
    const blobUrl = URL.createObjectURL(blob);
    containers.set(blobUrl, encoder.container);
    return { ok: true, blobUrl, duration: r?.duration ?? 0, size: blob.size };
}

/** Save a recorded video through the browser's save dialog. */
export async function saveVideo(blobUrl: string): Promise<void> {
    const container = containers.get(blobUrl) ?? 'mp4';
    await saveUrlAs(blobUrl, `sidekick-recording-${fileTimestamp()}.${container}`, {
        description: container === 'mp4' ? 'MP4 video' : 'WebM video',
        accept: { [MIME[container]]: [`.${container}`] },
    });
}
