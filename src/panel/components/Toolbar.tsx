import { useRef, useState, useEffect } from 'react';
import type { PanelState, Action } from "@/reducer";
import { attachToTab } from '@/lib/bridge';
import { runJsScript, runJsScriptStep } from '@/lib/run';
import { swTerminateExecution, swDebugResume } from '@/lib/sw-debugger';
import { SunIcon, MoonIcon, FolderOpenIcon, SaveIcon, ExportIcon, RecordIcon, StopIcon, BugIcon, CrosshairIcon, PlugIcon, UnplugIcon, ScreencastIcon } from './Icons';
import ExportSpecDialog from './ExportSpecDialog';
import { defaultTestName } from '@/lib/export-spec';
import type { EditorHandle } from './CodeMirrorEditorPane';
import { buildPickResult } from '@/lib/pick-info';
import type { ElementPickInfo } from '@/types';
import { startVideo, stopVideo, isVideoRecording as isVideoRecordingNow } from '@/lib/video-recorder';

interface ToolbarProps extends Pick<PanelState, 'editorContent' | 'stepLine' | 'attachedUrl' | 'attachedTabId' | 'isAttaching' | 'isRunning' | 'isStepDebugging' | 'breakPoints'> {
    dispatch: React.Dispatch<Action>,
    editorRef: React.RefObject<EditorHandle | null>,
};

function Toolbar({ editorContent, stepLine, attachedUrl, attachedTabId, isAttaching, isRunning, isStepDebugging, breakPoints, dispatch, editorRef }: ToolbarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isPicking, setIsPicking] = useState(false);
    // A saved choice wins; otherwise follow the system theme
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    const [availableTabs, setAvailableTabs] = useState<chrome.tabs.Tab[]>([]);
    const [canAttach, setCanAttach] = useState(true);
    const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
    const [isVideoRecording, setIsVideoRecording] = useState(false);
    const [exportDefaultName, setExportDefaultName] = useState<string | null>(null); // non-null = export dialog open
    const [videoElapsed, setVideoElapsed] = useState(0);
    const videoStartTimeRef = useRef(0);

    // ─── Tab switcher ───

    function isInternalUrl(url: string | undefined) {
        if (!url) return true;
        return url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('chrome-extension://');
    }

    const MAX_TAB_LABEL = 40;

    function truncateLabel(label: string): string {
        return label.length > MAX_TAB_LABEL ? `${label.slice(0, MAX_TAB_LABEL - 1)}…` : label;
    }

    // Page title first — several tabs of one app share a hostname — then a URL-based label.
    function getTabLabel(tab: chrome.tabs.Tab): string {
        const title = tab.title?.trim();
        if (title) return truncateLabel(title);
        try {
            if (tab.url?.startsWith('about:')) return tab.url;
            const url = new URL(tab.url!);
            if (url.protocol === 'chrome:') return `chrome://${url.hostname}`;
            if (url.protocol === 'edge:') return `edge://${url.hostname}`;
            if (url.protocol === 'file:') {
                const fileName = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
                return truncateLabel(fileName || tab.url!);
            }
            return truncateLabel(tab.url!);
        } catch {
            return tab.url ?? '(unknown)';
        }
    }

    async function loadTabs() {
        if (!chrome.tabs?.query) return;
        const tabs = await chrome.tabs.query({});
        // Keep chrome:// tabs (to preserve tab order) but exclude other extensions' pages.
        // Allow our own extension pages but exclude the panel/popup itself.
        const ownOrigin = `chrome-extension://${chrome.runtime.id}/`;
        const panelUrl = `${ownOrigin}panel/panel.html`;
        setAvailableTabs(tabs.filter(t => t?.url && !t.url.startsWith(panelUrl) && (!t.url.startsWith('chrome-extension://') || t.url.startsWith(ownOrigin))));
    }

    async function checkActiveTab() {
        if (!chrome.tabs?.query) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        setCanAttach(!isInternalUrl(tab?.url));
    }

    useEffect(() => {
        loadTabs();
        checkActiveTab();
        if (!chrome.tabs?.onActivated) return;
        const onActivated = (info: chrome.tabs.TabActiveInfo) => { setSelectedTabId(info.tabId); checkActiveTab(); };
        const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => { if (changeInfo.url || changeInfo.title) loadTabs(); };
        chrome.tabs.onActivated.addListener(onActivated);
        chrome.tabs.onUpdated.addListener(onUpdated);
        return () => { chrome.tabs.onActivated.removeListener(onActivated); chrome.tabs.onUpdated.removeListener(onUpdated); };
    }, []);

    async function doAttach(tabId: number) {
        dispatch({ type: 'ATTACH_START' });
        const res = await attachToTab(tabId);
        if (res.ok && res.url) {
            dispatch({ type: 'ATTACH_SUCCESS', url: res.url, tabId });
            setSelectedTabId(null); // attachedTabId takes over in dropdown
        } else {
            dispatch({ type: 'ATTACH_FAIL' });
            dispatch({ type: 'ADD_LINE', line: { text: `Attach failed: ${res.error ?? 'unknown error'}`, type: 'error' } });
            // keep selectedTabId so dropdown stays on the failed tab
        }
    }

    async function handleTabChange(tabId: number) {
        const tab = availableTabs.find(t => t.id === tabId);
        setSelectedTabId(tabId); // show in dropdown immediately
        chrome.tabs.update(tabId, { active: true }).catch(e => console.debug('[sidekick] tab activate:', e));
        if (tab && isInternalUrl(tab.url)) {
            dispatch({ type: 'DETACH' });
            return;
        }
        await doAttach(tabId);
    }

    // ─── Attach ───

    async function handleAttach() {
        // Reconnect to the tab shown in the dropdown; only use browser's active tab when nothing is selected/attached
        const targetTabId = selectedTabId ?? attachedTabId;
        if (targetTabId !== null) {
            const tab = availableTabs.find(t => t.id === targetTabId);
            if (tab && isInternalUrl(tab.url)) return;
            await doAttach(targetTabId);
            return;
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || isInternalUrl(tab.url)) return;
        await doAttach(tab.id);
    }

    // ─── File operations ───

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        const fileReader = new FileReader();
        fileReader.onload = () => {
            dispatch({ type: 'EDIT_EDITOR_CONTENT', content: fileReader.result as string })
            fileInputRef.current!.value = '';
        }
        fileReader.onerror = () => {
            dispatch({ type: 'ADD_LINE', line: { text: 'Failed to read file', type: 'error' } })
        }
        fileReader.readAsText(file);
    }

    function handleFileOpen() {
        fileInputRef.current!.click();
    }

    async function handleSave() {
        const defaultName = `script-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.js`;
        const opts = {
            suggestedName: defaultName,
            types: [{ description: "JavaScript files", accept: { "text/javascript": [".js"] } }],
        };
        try {
            const fileHandle: FileSystemFileHandle = await window.showSaveFilePicker(opts);
            const writable = await fileHandle.createWritable();
            await writable.write(editorContent);
            await writable.close();
        } catch (e: unknown) {
            if (e instanceof Error && e.name !== 'AbortError') {
                dispatch({ type: 'ADD_LINE', line: { text: 'Save failed: ' + e.message, type: 'error' } })
            }
        }
    }

    // ─── Export spec ───

    async function handleExportSpec() {
        const tabId = attachedTabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
        const tab = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
        setExportDefaultName(defaultTestName(tab?.title));
    }

    // ─── Run / Step / Stop ───

    async function handleRun() {
        dispatch({ type: 'RUN_START' });
        await runJsScript(editorContent, dispatch);
        dispatch({ type: 'RUN_STOP' });
    }

    function handleStop() {
        if (isStepDebugging) {
            swTerminateExecution().catch(e => console.warn('[debug] terminate failed:', e));
            swDebugResume().catch(e => console.warn('[debug] resume failed:', e)); // unpause so termination takes effect
        }
        dispatch({ type: 'RUN_STOP' });
    }

    async function handleDebug() {
        dispatch({ type: 'RUN_START', stepDebug: true });
        await runJsScriptStep(editorContent, dispatch, breakPoints);
        dispatch({ type: 'RUN_STOP' });
    }

    // ─── Recording (content script-based) ───

    function isEditorEmpty(): boolean {
        return editorContent.split('\n').every(line => {
            const trimmed = line.trim();
            if (!trimmed) return true;
            return trimmed.startsWith('//') || trimmed.startsWith('/*');
        });
    }

    useEffect(() => {
        if (!chrome.runtime?.onMessage) return;
        const listener = (msg: { type: string; action?: { js: string } }) => {
            if (msg.type === 'recorded-action' && msg.action) {
                editorRef.current?.insertAtCursor(msg.action.js);
            }
            if (msg.type === 'recorded-fill-update' && msg.action) {
                editorRef.current?.replaceLastInsert(msg.action.js);
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        return () => chrome.runtime.onMessage.removeListener(listener);
    }, []);

    // Auto-stop recording when run/debug starts
    useEffect(() => {
        if (isRunning && isRecording) {
            setIsRecording(false);
            chrome.runtime.sendMessage({ type: 'record-stop' }).catch(e => console.debug('[sidekick] record-stop:', e));
        }
    }, [isRunning]);

    async function handleRecord() {
        if (!chrome.tabs?.query) return;

        if (isRecording) {
            setIsRecording(false);
            chrome.runtime.sendMessage({ type: 'record-stop' }).catch(e => console.debug('[sidekick] record-stop:', e));
            return;
        }

        let result: { ok: boolean; url?: string; error?: string } | undefined;
        try {
            result = await chrome.runtime.sendMessage({ type: 'record-start' });
        } catch (e) {
            dispatch({ type: 'ADD_LINE', line: { text: `Recording failed: ${String(e)}`, type: 'error' } });
            return;
        }
        if (!result?.ok) {
            dispatch({ type: 'ADD_LINE', line: { text: `Recording failed: ${result?.error ?? 'unknown error'}`, type: 'error' } });
            return;
        }

        setIsRecording(true);

        if (result.url && result.url !== 'about:blank' && !result.url.startsWith('chrome://') && !result.url.startsWith('edge://') && isEditorEmpty()) {
            editorRef.current?.insertAtCursor(`await page.goto(${JSON.stringify(result.url)});`);
        }
    }

    // ─── Pick element ───

    async function handlePick() {
        if (!chrome.tabs?.query) return;

        if (isPicking) {
            setIsPicking(false);
            await chrome.runtime.sendMessage({ type: 'pick-cancel' }).catch(e => console.debug('[sidekick] pick-cancel:', e));
            return;
        }

        setIsPicking(true);
        try {
            const result = await chrome.runtime.sendMessage({ type: 'pick' }) as { ok: boolean; info?: ElementPickInfo & { ariaSnapshot?: string }; error?: string };
            if (!result?.ok || !result.info) {
                if (result?.error !== 'cancelled')
                    dispatch({ type: 'ADD_LINE', line: { text: `Pick failed: ${result?.error ?? 'unknown error'}`, type: 'error' } });
                return;
            }
            const info = result.info;
            const pickResult = buildPickResult(info, info.locator, info.ariaSnapshot);
            if (info.ariaSnapshot)
                pickResult.ariaSnapshot = info.ariaSnapshot.replace(/\s*\[(?:ref|cursor)=[^\]]*\]/g, '');
            dispatch({ type: 'ADD_LINE', line: { text: '', type: 'info', pickResult } });
        } catch (e) {
            dispatch({ type: 'ADD_LINE', line: { text: `Pick failed: ${String(e)}`, type: 'error' } });
        } finally {
            setIsPicking(false);
        }
    }

    function handleDetach() {
        dispatch({ type: 'DETACH' });
        // Let background know we're detaching (for cleanup)
        chrome.runtime.sendMessage({ type: 'detach' }).catch(e => console.debug('[sidekick] detach:', e));
    }

    // ─── Video capture (toolbar button) ───

    function formatElapsed(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // A recording left running by a closed panel can't be finished (its frames went to that panel): stop it
    useEffect(() => {
        chrome.runtime.sendMessage({ type: 'video-state' }).then((r: { recording?: boolean }) => {
            if (r?.recording && !isVideoRecordingNow()) chrome.runtime.sendMessage({ type: 'video-stop' }).catch(() => {});
        }).catch(() => {});
    }, []);

    // Timer tick while video recording
    useEffect(() => {
        if (!isVideoRecording) { setVideoElapsed(0); return; }
        const id = setInterval(() => {
            setVideoElapsed(Math.round((Date.now() - videoStartTimeRef.current) / 1000));
        }, 1000);
        return () => clearInterval(id);
    }, [isVideoRecording]);

    async function handleVideoRecord() {
        if (isVideoRecording || isVideoRecordingNow()) { // also stops a recording started from the console
            const r = await stopVideo();
            setIsVideoRecording(false);
            if (r.ok) {
                dispatch({ type: 'ADD_LINE', line: { text: 'Video recorded', type: 'info', video: r.blobUrl, videoDuration: r.duration, videoSize: r.size } });
            } else if (r.error !== 'Not recording') {
                dispatch({ type: 'ADD_LINE', line: { text: `Video stop failed: ${r.error}`, type: 'error' } });
            }
            return;
        }
        const r = await startVideo();
        if (r.ok) {
            setIsVideoRecording(true);
            videoStartTimeRef.current = Date.now();
        } else {
            dispatch({ type: 'ADD_LINE', line: { text: `Video failed: ${r.error ?? 'unknown'}`, type: 'error' } });
        }
    }

    // ─── Theme toggle ───

    useEffect(() => {
        document.documentElement.classList.toggle('theme-dark', isDarkMode);
    }, [isDarkMode]);

    // Saved only on an explicit toggle, so an unset theme keeps following the system
    function toggleTheme() {
        const next = !isDarkMode;
        localStorage.setItem('theme', next ? 'dark' : 'light');
        setIsDarkMode(next);
    }

    return (
        <div id="toolbar" className="flex flex-wrap gap-1 justify-between items-center py-1.5 px-2 bg-(--bg-toolbar) border-b border-solid border-(--border-primary) shrink-0">
            <div id="toolbar-left" className="flex flex-wrap gap-1 items-center">
                <input
                    type="file"
                    accept='.js,.ts'
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
                <button
                    data-testid="pick-btn"
                    className={isPicking ? 'picking' : ''}
                    title={isPicking ? "Stop picking" : "Pick element"}
                    disabled={isRecording}
                    onClick={handlePick}
                >
                    <CrosshairIcon />
                </button>
                <button
                    id="record-btn"
                    data-testid="record-btn"
                    className={isRecording ? 'recording' : ''}
                    title={isRecording ? "Stop recording" : "Start Recording"}
                    disabled={isPicking || isRunning}
                    onClick={handleRecord}
                >
                    {isRecording ? <StopIcon /> : <RecordIcon />}
                </button>
                {(isRunning || stepLine !== -1) && !isStepDebugging
                    ? <button id="stop-run-btn" data-testid="stop-run-btn" title="Stop" onClick={handleStop}><StopIcon /></button>
                    : <button id="run-btn" data-testid="run-btn" title="Run script (Ctrl+Enter)" disabled={!editorContent.trim() || isStepDebugging} onClick={handleRun}>&#9654;</button>
                }
                {!isRunning && stepLine === -1 && (
                    <button id="debug-btn" data-testid="debug-btn" title="Debug script" disabled={!editorContent.trim()} onClick={handleDebug}><BugIcon /></button>
                )}
                <span className="w-px h-4.5 bg-(--color-toolbar-sep) mx-1"></span>
                <button
                    id="video-btn"
                    data-testid="video-btn"
                    className={isVideoRecording ? 'video-recording' : ''}
                    title={isVideoRecording ? `Stop video (${formatElapsed(videoElapsed)})` : 'Record video'}
                    onClick={handleVideoRecord}
                >
                    <ScreencastIcon />
                    {isVideoRecording && <span className="ml-1 text-[12px] font-(family-name:--font-code)">{formatElapsed(videoElapsed)}</span>}
                </button>
                <button id="open-btn" title="Open script" onClick={handleFileOpen}><FolderOpenIcon /></button>
                <button id="save-btn" title="Save script" disabled={!editorContent.trim()} onClick={handleSave}><SaveIcon /></button>
                <button data-testid="export-spec-btn" title="Export as Playwright test (.spec.ts / .spec.js)" disabled={!editorContent.trim()} onClick={handleExportSpec}><ExportIcon /></button>
                <button onClick={toggleTheme} title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                    {isDarkMode ? <SunIcon /> : <MoonIcon />}
                </button>
            </div>
            <div id="toolbar-right" className="flex items-center gap-2">
                <select
                    value={selectedTabId ?? attachedTabId ?? ''}
                    title="Switch tab"
                    onFocus={loadTabs}
                    onChange={e => {
                        const tabId = Number(e.target.value);
                        if (tabId) handleTabChange(tabId);
                    }}
                >
                    {!selectedTabId && !attachedTabId && <option value="">— select tab —</option>}
                    {availableTabs.map(tab => (
                        <option key={tab.id} value={tab.id} title={tab.url}>{getTabLabel(tab)}</option>
                    ))}
                </select>
                <button
                    data-testid="attach-btn"
                    title={isAttaching ? 'Connecting...' : attachedUrl ? `Detach from ${attachedUrl}` : 'Attach to tab'}
                    disabled={!attachedUrl && (isAttaching || !canAttach || availableTabs.some(t => t.id === selectedTabId && isInternalUrl(t.url)))}
                    onClick={attachedUrl ? handleDetach : handleAttach}
                    style={{ color: isAttaching ? 'var(--color-warning, #facc15)' : attachedUrl ? 'var(--color-success)' : 'var(--color-error)' }}
                >
                    {attachedUrl ? <UnplugIcon /> : <PlugIcon />}
                </button>
            </div>
            {exportDefaultName !== null && (
                <ExportSpecDialog
                    script={editorContent}
                    defaultName={exportDefaultName}
                    onClose={() => setExportDefaultName(null)}
                    onError={text => dispatch({ type: 'ADD_LINE', line: { text, type: 'error' } })}
                />
            )}
        </div>
    )
}

export default Toolbar;
