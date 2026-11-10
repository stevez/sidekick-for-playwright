import { useReducer, useRef, useEffect, useState, useMemo } from 'react'
import Toolbar from './components/Toolbar'
import CodeMirrorEditorPane, { type EditorHandle } from "./components/CodeMirrorEditorPane"
import Splitter from './components/Splitter'
import { panelReducer, initialState } from './reducer'
import { attachToTab } from './lib/bridge'
import { BottomPane } from './components/BottomPane'
import DebugBar from './components/DebugBar';
import { onConsoleEvent } from '@/lib/sw-debugger';
import { saveSessionState, loadSessionState } from './lib/session-state';
import { getCommandHistory, addCommand } from './lib/command-history';
import { SerializedValue } from './components/Console/types'
import { formatInlineValues } from './lib/inline-values'

function App() {
  const [state, dispatch] = useReducer(panelReducer, initialState)
  const editorPaneRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<EditorHandle | null>(null);
  const attachedTabRef = useRef<number | null>(null);
  const [localProps, setLocalProps] = useState<Record<string, SerializedValue> | null>(null);
  // Opened as a separate window (popup) for one tab, instead of the side panel
  const popupTabId = useMemo(() => Number(new URLSearchParams(window.location.search).get('tabId')) || null, []);

  const inlineValues = useMemo(
    () => formatInlineValues(state.currentRunLine, localProps),
    [state.currentRunLine, localProps],
  );

  useEffect(() => {
    onConsoleEvent((level, args) => {
      if (level === 'debug') return; // internal diagnostics — not user-facing
      for (const arg of args) {
        const type = level === 'error' ? 'error' : level === 'warn' ? 'info' : 'success';
        dispatch({ type: 'ADD_LINE', line: { text: '', type, value: arg } });
      }
    });
    return () => onConsoleEvent(null);
  }, [dispatch]);

  // Restore session state across side panel close/reopen
  useEffect(() => {
    (async () => {
      const session = await loadSessionState();
      if (session) {
        if (session.editorContent) dispatch({ type: 'EDIT_EDITOR_CONTENT', content: session.editorContent });
        if (session.breakPoints.length) dispatch({ type: 'SET_BREAKPOINTS', breakPoints: new Set(session.breakPoints) });
        dispatch({ type: 'SET_BOTTOM_TAB', tab: session.bottomTab });
        if (session.editorPaneHeight && editorPaneRef.current) {
          editorPaneRef.current.style.flex = `0 0 ${session.editorPaneHeight}px`;
        }
        if (session.cursorPos) {
          setTimeout(() => editorRef.current?.setCursorPos(session.cursorPos), 50);
        }
        for (const cmd of session.commandHistory) addCommand(cmd);
      }
    })();
  }, []);

  function saveSession() {
    return saveSessionState({
      editorContent: state.editorContent,
      breakPoints: [...state.breakPoints],
      bottomTab: state.bottomTab,
      cursorPos: editorRef.current?.getCursorPos() ?? 0,
      editorPaneHeight: editorPaneRef.current?.offsetHeight ?? null,
      commandHistory: getCommandHistory(),
    });
  }

  // Save session state on every meaningful change (debounced)
  useEffect(() => {
    const timer = setTimeout(saveSession, 500);
    return () => clearTimeout(timer);
  }, [state.editorContent, state.breakPoints, state.bottomTab]);

  // ─── Side panel ↔ separate window ───
  // The other view restores the editor, breakpoints and history from the session state.

  async function handleModeSwitch() {
    await saveSession();
    const tabId = state.attachedTabId;
    if (popupTabId) {
      // Dock: open the side panel in the attached tab's window (the click is the user gesture)
      const tab = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
      let windowId = tab?.windowId;
      if (!windowId) {
        const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
        windowId = (windows.find(w => w.focused) ?? windows[0])?.id;
      }
      if (!windowId) return;
      await chrome.sidePanel.open({ windowId });
    } else {
      if (!tabId) {
        dispatch({ type: 'ADD_LINE', line: { text: 'Attach to a tab before opening a separate window.', type: 'error' } });
        return;
      }
      await chrome.windows.create({
        url: chrome.runtime.getURL(`panel/panel.html?tabId=${tabId}`),
        type: 'popup',
        width: 480,
        height: 760,
      });
    }
    window.close();
  }

  async function doAttach(tabId: number) {
    dispatch({ type: 'ATTACH_START' });
    const res = await attachToTab(tabId);
    if (res.ok && res.url) {
      attachedTabRef.current = tabId;
      dispatch({ type: 'ATTACH_SUCCESS', url: res.url, tabId });
    } else {
      attachedTabRef.current = null;
      dispatch({ type: 'ATTACH_FAIL' });
    }
  }

  useEffect(() => {
    if (!chrome.tabs?.query) return;

    // A separate window works on the tab it was opened for; switch tabs with the tab menu
    if (popupTabId) {
      doAttach(popupTabId);
      return;
    }

    // Attach to the current active tab, then follow tab switches
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const url = tab?.url ?? '';
      const ownOrigin = `chrome-extension://${chrome.runtime.id}/`;
      if (tab?.id && !url.startsWith('chrome://') &&
          (!url.startsWith('chrome-extension://') || url.startsWith(ownOrigin))) {
        doAttach(tab.id);
      }
    });

    const onActivated = async (info: chrome.tabs.TabActiveInfo) => {
      const tab = await chrome.tabs.get(info.tabId).catch(() => null);
      const url = tab?.url ?? '';
      if (url.startsWith('chrome-extension://') && !url.startsWith(`chrome-extension://${chrome.runtime.id}/`)) return;
      if (url.startsWith('chrome://')) {
        attachedTabRef.current = null;
        dispatch({ type: 'DETACH' });
        return;
      }
      doAttach(info.tabId);
    };
    chrome.tabs.onActivated.addListener(onActivated);

    // Auto-attach when the active tab navigates from an internal URL to a regular one
    // (e.g. user opens a new tab from chrome://extensions and types a URL).
    // Skip if already attached to this tab — re-attaching interrupts in-progress commands.
    const onUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (attachedTabRef.current === tabId) {
        if (changeInfo.url) dispatch({ type: 'UPDATE_URL', url: changeInfo.url });
        return;
      }
      if (changeInfo.url && !changeInfo.url.startsWith('chrome://') &&
          (!changeInfo.url.startsWith('chrome-extension://') || changeInfo.url.startsWith(`chrome-extension://${chrome.runtime.id}/`))) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id === tabId) doAttach(tabId);
        });
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return (
    <>
      {/* Toolbar + floating debug bar */}
      <Toolbar
        editorContent={state.editorContent}
        stepLine={state.stepLine}
        isRunning={state.isRunning}
        isStepDebugging={state.isStepDebugging}
        attachedUrl={state.attachedUrl}
        attachedTabId={state.attachedTabId}
        isAttaching={state.isAttaching}
        dispatch={dispatch}
        editorRef={editorRef}
        breakPoints={state.breakPoints}
        isPopup={popupTabId !== null}
        onModeSwitch={handleModeSwitch}
      />
      {state.isStepDebugging && <DebugBar dispatch={dispatch} />}

      {/* Editor pane */}
      <div ref={editorPaneRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 80, overflow: 'hidden' }}>
        <CodeMirrorEditorPane
          ref={editorRef}
          editorContent={state.editorContent}
          currentRunLine={state.currentRunLine}
          lineResults={state.lineResults}
          inlineValues={inlineValues}
          dispatch={dispatch}
        />
      </div>

      {/* Splitter */}
      <Splitter editorPaneRef={editorPaneRef} />

      <BottomPane
          outputLines={state.outputLines}
          dispatch={dispatch}
          bottomTab={state.bottomTab}
          isStepDebugging={state.isStepDebugging}
          scopeData={state.scopeData}
          onLocalProps={setLocalProps}
      />
    </>
  )
}

export default App
