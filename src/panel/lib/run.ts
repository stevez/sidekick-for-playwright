import { executeCommand } from '@/lib/bridge';
import type { CommandResult } from '@/types';
import type { Action } from '@/reducer';
import { addCommand } from '@/lib/command-history';
import { runLocalCommand } from '@/lib/local-commands';
import { swDebugEval, swDebugEvalRaw, swGetProperties, swDebuggerEnable, swDebuggerDisable, swDebugPause, swDebugResume, onDebugPaused, swTrackBreakpoint, swSetBreakpointByUrl, swRemoveAllBreakpoints, ScopeInfo } from '@/lib/sw-debugger';
import { fromCdpRemoteObject } from '@/components/Console/cdpToSerialized';
import type { CdpRemoteObject } from '@/components/Console/cdpToSerialized';

function trimStack(msg: string): string {
    return msg.split('\n    at ')[0].split('\nCall log:')[0].trim();
}

export async function runJsScript(code: string, dispatch: React.Dispatch<Action>): Promise<void> {
    dispatch({ type: 'COMMAND_SUBMITTED', line: { text: '(run JS script)', type: 'command' } });
    try {
        const start = performance.now();
        const raw = await swDebugEval(code) as { result?: CdpRemoteObject };
        const time = Math.round(performance.now() - start);
        const r = raw?.result;
        if (!r || r.type === 'undefined') {
            dispatch({ type: 'COMMAND_SUCCESS', line: { text: 'Done', type: 'success', time } });
        } else if (r.type === 'string') {
            dispatch({ type: 'COMMAND_SUCCESS', line: { text: r.value as string, type: 'success', time } });
        } else if (r.type === 'number' || r.type === 'boolean') {
            dispatch({ type: 'COMMAND_SUCCESS', line: { text: String(r.value), type: 'success', time } });
        } else {
            const value = fromCdpRemoteObject(r);
            dispatch({ type: 'COMMAND_SUCCESS', line: { text: '', type: 'success', time, value, getProperties: swGetProperties } });
        }
    } catch (e: unknown) {
        const text = trimStack(e instanceof Error ? e.message : String(e));
        dispatch({ type: 'COMMAND_ERROR', line: { text, type: 'error' } });
    }
}

export async function runJsScriptStep(code: string, dispatch: React.Dispatch<Action>, breakPoints?: Set<number>): Promise<void> {
    dispatch({ type: 'COMMAND_SUBMITTED', line: { text: '(debug JS script)', type: 'command' } });

    const lines = code.split('\n');
    let lineCount = lines.length;
    while (lineCount > 0 && lines[lineCount - 1].trim() === '') lineCount--;
    if (lineCount === 0) lineCount = 1;
    const sourceURL = 'pw-repl-debug.js';

    try {
        await swDebuggerEnable();
        if (breakPoints?.size) {
            for (const line of breakPoints) {
                const bpId = await swSetBreakpointByUrl(sourceURL, line);
                if (bpId) swTrackBreakpoint(bpId);
            }
        }

        // Pause before the first executed statement (skips hoisted declarations)
        await swDebugPause();

        let lastPausedLine = -1;
        onDebugPaused((line: number, scopes: ScopeInfo[]) => {
            if (line >= 0 && line < lineCount) {
                lastPausedLine = line;
                dispatch({ type: 'SET_RUN_LINE', currentRunLine: line });
                dispatch({ type: 'SET_SCOPE_DATA', scopes});
            } else if (lastPausedLine < lineCount - 1) {
                // Jumped past user code (e.g. step-out) — show last user line
                lastPausedLine = lineCount - 1;
                dispatch({ type: 'SET_RUN_LINE', currentRunLine: lineCount - 1 });
                dispatch({ type: 'SET_SCOPE_DATA', scopes});
            } else {
                // Already at last line, stepped past — finish
                swDebugResume().catch(e => console.debug('[debug] auto-resume:', e));
            }
        });

        const codeWithSource = code + '\n//# sourceURL=' + sourceURL;
        const result = await swDebugEvalRaw(codeWithSource);

        // 5. Handle result
        if (result.exceptionDetails) {
            const msg: string = result.exceptionDetails.exception?.description
                ?? result.exceptionDetails.text ?? 'Unknown error';
            if (msg.includes('terminated')) {
                dispatch({ type: 'ADD_LINE', line: { text: 'Stopped.', type: 'info' } });
            } else {
                dispatch({ type: 'COMMAND_ERROR', line: { text: trimStack(msg), type: 'error' } });
            }
        } else {
            const r = result.result;
            if (!r || r.type === 'undefined') {
                dispatch({ type: 'COMMAND_SUCCESS', line: { text: 'Done', type: 'success' } });
            } else if (r.type === 'string') {
                dispatch({ type: 'COMMAND_SUCCESS', line: { text: r.value as string, type: 'success' } });
            } else if (r.type === 'number' || r.type === 'boolean') {
                dispatch({ type: 'COMMAND_SUCCESS', line: { text: String(r.value), type: 'success' } });
            } else {
                const value = fromCdpRemoteObject(r);
                dispatch({ type: 'COMMAND_SUCCESS', line: { text: '', type: 'success', value, getProperties: swGetProperties } });
            }
        }
    } catch (e: unknown) {
        dispatch({ type: 'COMMAND_ERROR', line: { text: trimStack(e instanceof Error ? e.message : String(e)), type: 'error' } });
    } finally {
        onDebugPaused(null);
        await swDebuggerDisable().catch(e => console.debug('[debug] disable:', e));
        await swRemoveAllBreakpoints().catch(e => console.debug('[debug] cleanup breakpoints:', e));
    }
}

export async function runAndDispatch(command: string, dispatch: React.Dispatch<Action>): Promise<CommandResult> {

    if (!command.trim() || runLocalCommand(command, dispatch))
         return { text: '', isError: false };

    addCommand(command);
    dispatch({ type: 'COMMAND_SUBMITTED', line: { text: command, type: 'command' } });

    try {
        const start = performance.now();
        const result = await executeCommand(command);
        const time = Math.round(performance.now() - start);
        dispatch({
            type: result.isError ? 'COMMAND_ERROR' : 'COMMAND_SUCCESS', line: {
                text: result.text,
                type: result.isError ? 'error' : result.image ? 'screenshot' : 'success',
                time,
                image: result.image
            }
        });
        return result;
    } catch {
        dispatch({
            type: 'COMMAND_ERROR', line: {
                text: 'Command failed. Try clicking Attach first.',
                type: 'error'
            }
        });
        return { text: '', isError: true };
    }
}
