import type { ConsoleEntry } from './types';
import { addCommand } from '@/lib/command-history';
import { runLocalCommand } from '@/lib/local-commands';
import { swDebugEval, swGetProperties } from '@/lib/sw-debugger';
import { fromCdpRemoteObject, type CdpRemoteObject } from './cdpToSerialized';
import { runJsScript } from '@/lib/run';
import type { Action } from '@/reducer';
import type React from 'react';

/** Evaluate console input as Playwright JavaScript (page, context, expect in scope). */
async function evaluate(expr: string): Promise<{ value?: ConsoleEntry['value']; text?: string; getProperties?: ConsoleEntry['getProperties'] }> {
    const raw = await swDebugEval(expr) as { result?: CdpRemoteObject; error?: string };
    if (raw?.error) throw new Error(raw.error);
    if (!raw?.result) throw new Error('No result from service worker');
    const result = raw.result as CdpRemoteObject;
    if (result.type === 'undefined') return { text: 'Done' };
    return { value: fromCdpRemoteObject(result), getProperties: swGetProperties };
}

export function useConsole(dispatch: React.Dispatch<Action>) {
    async function execute(input: string) {
        const trimmed = input.trim();
        if (!trimmed) return;

        if (runLocalCommand(trimmed, dispatch)) return;

        addCommand(trimmed);

        dispatch({ type: 'COMMAND_SUBMITTED', line: { text: trimmed, type: 'command' } });

        try {
            const start = performance.now();
            const result = await evaluate(trimmed);
            const time = Math.round(performance.now() - start);
            if (result.value !== undefined) {
                dispatch({ type: 'COMMAND_SUCCESS', line: { text: '', type: 'success', time, value: result.value, getProperties: result.getProperties } });
            } else {
                dispatch({ type: 'COMMAND_SUCCESS', line: { text: result.text ?? 'Done', type: 'success', time } });
            }
        } catch (e: unknown) {
            const raw = e instanceof Error ? e.message : String(e);
            const errorText = raw.split('\n    at ')[0].split('\nCall log:')[0].trim();
            dispatch({ type: 'COMMAND_ERROR', line: { text: errorText, type: 'error' } });
        }
    }

    function addResult({ input, value, text, image, getProperties }: { input: string; value?: ConsoleEntry['value']; text?: string; image?: string; getProperties?: ConsoleEntry['getProperties'] }) {
        dispatch({ type: 'COMMAND_SUBMITTED', line: { text: input, type: 'command' } });
        dispatch({
            type: 'COMMAND_SUCCESS',
            line: {
                text: text ?? '',
                type: image ? 'screenshot' : 'success',
                image,
                value,
                getProperties,
            }
        });
    }

    async function runScript(code: string) {
        await runJsScript(code, dispatch);
    }

    return { execute, addResult, runScript };
}
