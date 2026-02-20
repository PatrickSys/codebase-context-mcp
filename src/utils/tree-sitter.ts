import { createRequire } from 'module';
import { Language, Parser, type Node } from 'web-tree-sitter';
import {
  CURATED_LANGUAGE_TO_WASM,
  supportsCuratedTreeSitter,
  resolveGrammarPath
} from '../grammars/manifest.js';

export interface TreeSitterSymbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
  content: string;
  nodeType: string;
}

export interface TreeSitterSymbolExtraction {
  grammarFile: string;
  symbols: TreeSitterSymbol[];
}

const require = createRequire(import.meta.url);

const CORE_WASM_PATH = require.resolve('web-tree-sitter/tree-sitter.wasm');

const SYMBOL_CANDIDATE_NODE_TYPES = [
  'class_declaration',
  'class_definition',
  'class_specifier',
  'constructor_declaration',
  'enum_declaration',
  'enum_item',
  'function_declaration',
  'function_definition',
  'function_item',
  'generator_function_declaration',
  'interface_declaration',
  'lexical_declaration',
  'method',
  'method_declaration',
  'method_definition',
  'struct_item',
  'struct_specifier',
  'trait_item',
  'type_alias_declaration',
  'type_declaration',
  'type_spec',
  'variable_declarator'
] as const;

const NAME_FIELD_CANDIDATES = ['name', 'declarator', 'property', 'path'] as const;
const NAME_NODE_TYPE_HINTS = [
  'identifier',
  'type_identifier',
  'property_identifier',
  'scoped_identifier',
  'constant',
  'name'
] as const;

const MAX_TREE_SITTER_PARSE_BYTES = 1024 * 1024;
const TREE_SITTER_PARSE_TIMEOUT_MICROS = 30_000_000n;

let initPromise: Promise<void> | null = null;
const languageCache = new Map<string, Promise<Language>>();
const parserCache = new Map<string, Promise<Parser>>();

function maybeResetParser(parser: Parser): void {
  const maybeReset = (parser as Parser & { reset?: () => void }).reset;
  if (typeof maybeReset === 'function') {
    maybeReset.call(parser);
  }
}

function evictParser(language: string, parser?: Parser): void {
  if (parser) {
    maybeResetParser(parser);
  }
  parserCache.delete(language);
}

function setParseTimeout(parser: Parser): void {
  const maybeSetTimeout = (
    parser as Parser & { setTimeoutMicros?: (timeout: number | bigint) => void }
  ).setTimeoutMicros;
  if (typeof maybeSetTimeout === 'function') {
    try {
      maybeSetTimeout.call(parser, TREE_SITTER_PARSE_TIMEOUT_MICROS);
    } catch {
      try {
        maybeSetTimeout.call(parser, Number(TREE_SITTER_PARSE_TIMEOUT_MICROS));
      } catch {
        // Ignore timeout wiring failures; parser execution still proceeds.
      }
    }
  }
}

function sliceUtf8(content: string, startIndex: number, endIndex: number): string {
  const utf8 = Buffer.from(content, 'utf8');
  return utf8.subarray(startIndex, endIndex).toString('utf8');
}

function extractNodeContent(node: Node, content: string): string {
  const byteSlice = sliceUtf8(content, node.startIndex, node.endIndex);
  const codeUnitSlice = content.slice(node.startIndex, node.endIndex);

  if (node.text === codeUnitSlice && node.text !== byteSlice) {
    return codeUnitSlice;
  }

  return byteSlice;
}

function isTreeSitterDebugEnabled(): boolean {
  return Boolean(process.env.CODEBASE_CONTEXT_DEBUG);
}

export function supportsTreeSitter(language: string): boolean {
  return supportsCuratedTreeSitter(language);
}

async function ensureParserInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init({
      locateFile(scriptName: string) {
        if (scriptName === 'tree-sitter.wasm') {
          return CORE_WASM_PATH;
        }
        return scriptName;
      }
    });
  }

  await initPromise;
}

async function loadLanguage(language: string): Promise<Language> {
  const wasmFile = CURATED_LANGUAGE_TO_WASM[language];
  if (!wasmFile) {
    throw new Error(`Tree-sitter grammar is not configured for '${language}'.`);
  }

  let cachedLanguage = languageCache.get(language);
  if (!cachedLanguage) {
    const { wasmPath } = resolveGrammarPath(language, import.meta.url);
    cachedLanguage = Language.load(wasmPath).catch((err) => {
      // Evict failed entry so later calls can retry after fixes
      languageCache.delete(language);
      throw err;
    });
    languageCache.set(language, cachedLanguage);
  }

  return cachedLanguage;
}

async function getParserForLanguage(language: string): Promise<Parser> {
  let cachedParser = parserCache.get(language);
  if (!cachedParser) {
    cachedParser = (async () => {
      await ensureParserInitialized();
      const parser = new Parser();
      try {
        parser.setLanguage(await loadLanguage(language));
      } catch (err) {
        // setLanguage failed — evict both caches so retry is possible
        parserCache.delete(language);
        languageCache.delete(language);
        throw err;
      }
      return parser;
    })();
    parserCache.set(language, cachedParser);
  }

  return cachedParser;
}

function getNodeKind(nodeType: string): string {
  if (nodeType.includes('class')) return 'class';
  if (nodeType.includes('interface')) return 'interface';
  if (nodeType.includes('enum')) return 'enum';
  if (nodeType.includes('struct')) return 'struct';
  if (nodeType.includes('trait')) return 'trait';
  if (nodeType.includes('constructor')) return 'method';
  if (nodeType.includes('method')) return 'method';
  if (nodeType.includes('type_alias') || nodeType === 'type_spec') return 'type';
  return 'function';
}

function normalizeSymbolName(rawName: string): string {
  return rawName
    .replace(/[\s\n\t]+/g, ' ')
    .trim()
    .replace(/^[:@#]+/, '');
}

function maybeGetNameNode(node: Node): Node | null {
  for (const fieldName of NAME_FIELD_CANDIDATES) {
    const field = node.childForFieldName(fieldName);
    if (field) {
      return field;
    }
  }

  for (const child of node.namedChildren) {
    if (!child) continue;
    if (NAME_NODE_TYPE_HINTS.some((hint) => child.type.includes(hint))) {
      return child;
    }
  }

  return null;
}

function extractNodeName(node: Node): string {
  const nameNode = maybeGetNameNode(node);
  if (nameNode?.text) {
    const normalized = normalizeSymbolName(nameNode.text);
    if (normalized) {
      return normalized;
    }
  }

  const compact = node.text.slice(0, 120).replace(/\s+/g, ' ').trim();
  const match = compact.match(
    /(?:class|interface|enum|struct|trait|function|def|fn)\s+([A-Za-z_][\w$]*)/
  );
  if (match?.[1]) {
    return match[1];
  }

  return 'anonymous';
}

function isFunctionVariableDeclarator(node: Node): boolean {
  if (node.type !== 'variable_declarator') {
    return false;
  }

  const valueNode = node.childForFieldName('value');
  if (!valueNode) {
    return false;
  }

  return valueNode.type === 'arrow_function' || valueNode.type === 'function_expression';
}

function shouldSkipNode(language: string, node: Node): boolean {
  if (node.type === 'variable_declarator') {
    return (
      !['javascript', 'javascriptreact', 'typescript', 'typescriptreact'].includes(language) ||
      !isFunctionVariableDeclarator(node)
    );
  }

  if (node.type === 'lexical_declaration') {
    return true;
  }

  if (node.type === 'type_declaration') {
    return true;
  }

  return false;
}

function getSymbolRangeNode(node: Node): Node {
  const parent = node.parent;
  if (parent?.type === 'export_statement') {
    return parent;
  }
  return node;
}

function buildSymbol(node: Node, content: string): TreeSitterSymbol {
  const rangeNode = getSymbolRangeNode(node);

  return {
    name: extractNodeName(node),
    kind: getNodeKind(node.type),
    startLine: rangeNode.startPosition.row + 1,
    endLine: rangeNode.endPosition.row + 1,
    startIndex: rangeNode.startIndex,
    endIndex: rangeNode.endIndex,
    content: extractNodeContent(rangeNode, content),
    nodeType: node.type
  };
}

export async function extractTreeSitterSymbols(
  content: string,
  language: string
): Promise<TreeSitterSymbolExtraction | null> {
  if (!supportsTreeSitter(language) || !content.trim()) {
    return null;
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_TREE_SITTER_PARSE_BYTES) {
    return null;
  }

  try {
    const parser = await getParserForLanguage(language);
    setParseTimeout(parser);

    let tree: ReturnType<Parser['parse']>;
    try {
      tree = parser.parse(content);
    } catch (error) {
      evictParser(language, parser);
      throw error;
    }

    if (!tree) {
      evictParser(language, parser);
      return null;
    }

    try {
      const hasErrorValue = tree.rootNode.hasError as unknown;
      const rootHasError =
        typeof hasErrorValue === 'function'
          ? Boolean((hasErrorValue as () => unknown)())
          : Boolean(hasErrorValue);

      if (rootHasError) {
        return null;
      }

      const nodes = tree.rootNode.descendantsOfType([...SYMBOL_CANDIDATE_NODE_TYPES]);
      const seen = new Set<string>();
      const symbols: TreeSitterSymbol[] = [];

      for (const node of nodes) {
        if (!node || !node.isNamed || shouldSkipNode(language, node)) {
          continue;
        }

        const symbol = buildSymbol(node, content);
        if (symbol.name === 'anonymous') {
          continue;
        }

        const key = `${symbol.kind}:${symbol.name}:${symbol.startLine}:${symbol.endLine}`;
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        symbols.push(symbol);
      }

      symbols.sort((a, b) => {
        if (a.startLine !== b.startLine) {
          return a.startLine - b.startLine;
        }
        return a.endLine - b.endLine;
      });

      return {
        grammarFile: CURATED_LANGUAGE_TO_WASM[language] ?? language,
        symbols
      };
    } finally {
      tree.delete();
    }
  } catch (error) {
    evictParser(language);

    if (isTreeSitterDebugEnabled()) {
      console.error(
        `[DEBUG] Tree-sitter symbol extraction failed for '${language}':`,
        error instanceof Error ? error.message : String(error)
      );
    }
    return null;
  }
}
