/**
 * Editor completion data, generated from the Playwright types bundled in
 * @playwright-repl/playwright-crx, so completion always matches the crx version
 * the extension runs.
 *
 * Parses the .d.ts files with the TypeScript compiler API at build time and serves
 * the result as the `virtual:pw-completions` module (see completionsPlugin).
 *
 * Output shape:
 *   {
 *     "Page": [
 *       { "label": "goto", "type": "method", "detail": "(url: string, options?: { … }) => Promise<Response | null>" },
 *       { "label": "keyboard", "type": "property", "detail": "Keyboard", "returns": "Keyboard" },
 *       ...
 *     ],
 *     "Locator": [...],
 *     "LocatorAssertions": [...], "PageAssertions": [...], "GenericAssertions": [...]
 *   }
 */

import ts from 'typescript';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import type { Plugin } from 'vite';

export interface RawCompletion {
  label: string;
  type: 'method' | 'property';
  detail: string;
  /** Interface this member returns synchronously (for chained completions) */
  returns?: string;
}

export type CompletionData = Record<string, RawCompletion[]>;

// ─── Config ──────────────────────────────────────────────────────────────────

// Interfaces from playwright-core's types.d.ts
const API_INTERFACES = new Set([
  'Page', 'Locator', 'FrameLocator', 'BrowserContext', 'Browser', 'ElementHandle', 'Frame',
  'Keyboard', 'Mouse', 'Touchscreen', 'Request', 'Response', 'Route',
  'Download', 'FileChooser', 'Dialog', 'ConsoleMessage',
]);

// Matcher interfaces from playwright's test.d.ts
const ASSERTION_INTERFACES = new Set(['LocatorAssertions', 'PageAssertions', 'GenericAssertions']);

// Deprecated/legacy methods per interface — only block where actually deprecated
// (e.g. isVisible is deprecated on Page but valid on Locator)
const PAGE_LEGACY = ['$', '$$', '$eval', '$$eval', 'waitForSelector', 'waitForTimeout',
  'isChecked', 'isDisabled', 'isEditable', 'isEnabled', 'isHidden', 'isVisible',
  'getAttribute', 'innerText', 'innerHTML', 'textContent', 'inputValue'];
const DEPRECATED_BY_INTERFACE: Record<string, Set<string>> = {
  Page: new Set(PAGE_LEGACY),
  Frame: new Set(PAGE_LEGACY),
  ElementHandle: new Set(['$', '$$', '$eval', '$$eval', 'waitForSelector']),
};

const MAX_DETAIL = 120;

export function typesFiles() {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve('@playwright-repl/playwright-crx/package.json'));
  return {
    api: resolve(root, 'playwright/packages/playwright-core/types/types.d.ts'),
    test: resolve(root, 'playwright/packages/playwright/types/test.d.ts'),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function leadingComment(node: ts.Node, sourceFile: ts.SourceFile): string {
  const fullText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!ranges?.length) return '';
  // The closest comment block before the node is its JSDoc
  const last = ranges[ranges.length - 1];
  return fullText.slice(last.pos, last.end);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/** Name of a target interface the type refers to, ignoring null/undefined */
function interfaceOf(type: ts.Type): string | undefined {
  const parts = type.isUnion() ? type.types : [type];
  const names = parts
    .filter(t => !(t.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)))
    .map(t => (t.aliasSymbol ?? t.getSymbol())?.getName());
  return names.length === 1 && names[0] && API_INTERFACES.has(names[0]) ? names[0] : undefined;
}

function describeMember(checker: ts.TypeChecker, member: ts.TypeElement): Pick<RawCompletion, 'type' | 'detail' | 'returns'> | undefined {
  if (ts.isMethodSignature(member)) {
    const sig = checker.getSignatureFromDeclaration(member);
    if (!sig) return undefined;
    const params = sig.getParameters().map(p => {
      const decl = p.valueDeclaration;
      const optional = decl && ts.isParameter(decl) && checker.isOptionalParameter(decl) ? '?' : '';
      return `${p.name}${optional}: ${checker.typeToString(checker.getTypeOfSymbolAtLocation(p, member))}`;
    }).join(', ');
    const ret = sig.getReturnType();
    return { type: 'method', detail: `(${params}) => ${checker.typeToString(ret)}`, returns: interfaceOf(ret) };
  }
  if (ts.isPropertySignature(member) || ts.isGetAccessor(member)) {
    const symbol = checker.getSymbolAtLocation(member.name);
    if (!symbol) return undefined;
    const type = checker.getTypeOfSymbolAtLocation(symbol, member);
    const detail = checker.typeToString(type, undefined,
        ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
    return { type: 'property', detail, returns: interfaceOf(type) };
  }
  return undefined;
}

function extractInterface(checker: ts.TypeChecker, sourceFile: ts.SourceFile, decl: ts.InterfaceDeclaration): RawCompletion[] {
  const name = decl.name.text;
  const isAssertions = ASSERTION_INTERFACES.has(name);
  const members: RawCompletion[] = [];
  const seen = new Set<string>();

  for (const member of decl.members) {
    const label = member.name?.getText(sourceFile);
    // Overloads repeat the name: the first declaration carries the docs
    if (!label || seen.has(label) || label.startsWith('_')) continue;
    seen.add(label);
    // Assertion interfaces also hold modifiers (not, resolves, rejects)
    if (isAssertions && !/^to[A-Z]/.test(label)) continue;

    const comment = leadingComment(member, sourceFile);
    if (DEPRECATED_BY_INTERFACE[name]?.has(label) || /@deprecated/i.test(comment)) continue;

    const described = describeMember(checker, member);
    if (!described) continue;
    members.push({
      label,
      type: described.type,
      detail: truncate(described.detail, MAX_DETAIL),
      ...(described.returns ? { returns: described.returns } : {}),
    });
  }
  return members;
}

// ─── Extract ─────────────────────────────────────────────────────────────────

export function extractCompletions(files = typesFiles()): CompletionData {
  const program = ts.createProgram([files.api, files.test], {
    target: ts.ScriptTarget.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const result: CompletionData = {};

  for (const [file, wanted] of [[files.api, API_INTERFACES], [files.test, ASSERTION_INTERFACES]] as const) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) throw new Error(`Could not load Playwright types: ${file}`);
    for (const statement of sourceFile.statements) {
      if (!ts.isInterfaceDeclaration(statement) || !wanted.has(statement.name.text)) continue;
      const members = extractInterface(checker, sourceFile, statement);
      if (members.length) result[statement.name.text] = members;
    }
  }

  for (const name of [...API_INTERFACES, ...ASSERTION_INTERFACES]) {
    if (!result[name]) throw new Error(`No completions found for ${name} in the Playwright types`);
  }
  return result;
}

// ─── Vite plugin ─────────────────────────────────────────────────────────────

const VIRTUAL_ID = 'virtual:pw-completions';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/** Serves extractCompletions() as `import data from 'virtual:pw-completions'` */
export function completionsPlugin(): Plugin {
  return {
    name: 'pw-completions',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const files = typesFiles();
      this.addWatchFile(files.api);
      this.addWatchFile(files.test);
      return `export default ${JSON.stringify(extractCompletions(files))};`;
    },
  };
}
