import yaml from 'js-yaml';

export interface SnapshotNode {
    text: string,
    ref?: string,
    value?: string,
    children: SnapshotNode[];
}

export function parseSnapshot(yamlText: string): SnapshotNode | null {
    const parsed = yaml.load(yamlText);
    if (!Array.isArray(parsed)) return null;
    const nodes = toNodes(parsed);
    return nodes[0] ?? null;
}

function toNodes(parsed: unknown[]): SnapshotNode[] {
    return parsed.flatMap((item): SnapshotNode[] => {
        if(typeof item === 'string') {
            return [{ text: item, ref: extractRef(item), children: []}]
        }
        // Object: { "document [ref=e1]": [...children] } or { "textbox [ref=e5]": "value" };
        // a mapping with several keys becomes one node per key
        return Object.entries(item as Record<string, unknown>).map(([key, val]) => {
            const isScalar = typeof val === 'string' || typeof val === 'number';
            const children = Array.isArray(val) ? toNodes(val) : [];
            const text = isScalar ? `${key}: ${String(val)}` : key;
            return { text, ref: extractRef(key), value: isScalar ? String(val) : undefined, children }
        })
    })
}

// "document [ref=e1]" → "e1"
function extractRef(text: string): string | undefined {
  return text.match(/\[ref=(e\d+)\]/)?.[1];
}
