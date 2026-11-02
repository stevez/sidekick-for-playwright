import type { ConsoleEntry } from './types';
import { addCommand } from '@/lib/command-history';
import { runLocalCommand } from '@/lib/local-commands';
import { swDebugEval, swGetProperties } from '@/lib/sw-debugger';
import { executeCommandForConsole } from '@/lib/bridge';
import { fromCdpRemoteObject, type CdpRemoteObject } from './cdpToSerialized';
import { runJsScript } from '@/lib/run';
import type { Action } from '@/reducer';
import type React from 'react';

const CAPTURE_COMMANDS = new Set(['video-start', 'video-stop', 'tracing-start', 'tracing-stop']);

const executors = {
    js: async (expr: string) => {
        const raw = await swDebugEval(expr) as { result?: CdpRemoteObject; error?: string };
        if (raw?.error) throw new Error(raw.error);
        if (!raw?.result) throw new Error('No result from service worker');
        const result = raw.result as CdpRemoteObject;
        if (result.type === 'undefined') return { text: 'Done' as string };
        return { value: fromCdpRemoteObject(result), getProperties: swGetProperties };
    },
    capture: async (command: string) => {
        const result = await executeCommandForConsole(command);
        if ('cdpResult' in result) {
            return { value: fromCdpRemoteObject(result.cdpResult), getProperties: swGetProperties };
        }
        if (result.image) return { image: result.image as string };
        if ('video' in result && result.video) return { video: result.video, duration: result.duration, size: result.size };
        if ('trace' in result && result.trace) return { text: result.text || 'Tracing stopped', trace: true, traceSize: result.traceSize };
        return { text: (result.text || 'Done') as string };
    },
};

export function useConsole(dispatch: React.Dispatch<Action>) {
    async function execute(input: string) {
        const trimmed = input.trim();
        if (!trimmed) return;

        if (runLocalCommand(trimmed, dispatch)) return;

        addCommand(trimmed);

        const isCapture = CAPTURE_COMMANDS.has(trimmed.toLowerCase());
        dispatch({ type: 'COMMAND_SUBMITTED', line: { text: trimmed, type: 'command' } });

        try {
            const start = performance.now();
            const result = await (isCapture ? executors.capture(trimmed) : executors.js(trimmed)) as { value?: ConsoleEntry['value']; text?: string; image?: string; video?: string; duration?: number; size?: number; trace?: boolean; traceSize?: number; getProperties?: ConsoleEntry['getProperties'] };
            const time = Math.round(performance.now() - start);
            if (result.value !== undefined) {
                dispatch({ type: 'COMMAND_SUCCESS', line: { text: '', type: 'success', time, value: result.value, getProperties: result.getProperties } });
            } else if (result.trace) {
                dispatch({ type: 'COMMAND_SUCCESS', line: { text: result.text ?? 'Tracing stopped', type: 'success', time, trace: true, traceSize: result.traceSize } });
            } else if (result.video !== undefined) {
                dispatch({ type: 'COMMAND_SUCCESS', line: { text: 'Video recorded', type: 'success', time, video: result.video, videoDuration: result.duration, videoSize: result.size } });
            } else if (result.image !== undefined) {
                dispatch({ type: 'COMMAND_SUCCESS', line: { text: '', type: 'screenshot', time, image: result.image } });
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
