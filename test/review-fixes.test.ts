import { describe, it, expect, beforeEach } from 'vitest';
import { parseSnapshot } from '@/lib/snapshot-parser';
import { addCommand, clearHistory, getCommandHistory, goUp } from '@/lib/command-history';

describe('parseSnapshot', () => {
    it('keeps every key of a YAML mapping', () => {
        const root = parseSnapshot('- list:\n  - listitem: One\n    listitem2: Two\n');
        expect(root?.children.map(c => c.text)).toEqual(['listitem: One', 'listitem2: Two']);
    });
});

describe('command history', () => {
    beforeEach(() => clearHistory());

    it('keeps only the newest 500 commands', () => {
        for (let i = 0; i < 510; i++) addCommand(`cmd ${i}`);
        const history = getCommandHistory();
        expect(history).toHaveLength(500);
        expect(history[0]).toBe('cmd 10');
        expect(goUp()).toBe('cmd 509');
    });
});
