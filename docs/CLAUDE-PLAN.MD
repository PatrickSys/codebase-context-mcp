● Plan looks complete. Summary of what it covers:

4 files, 5 steps:  
 1. Type interfaces (src/tools/types.ts) — 7 new interfaces replacing all Record<string, unknown> casts  
 2. Fix providedIn bug (src/utils/chunking.ts) — spread component.metadata in chunk creation so decorator-extracted fields survive the pipeline. Also remove redundant standalone tag.  
 3. Fix labels (src/analyzers/angular/index.ts) — "Standalone" → "Standalone component", skip showing providedIn: unknown when not available 4. CLI formatters (src/cli.ts) — Box art for search preflight + patterns + refs graph tree. Human-readable labels: interceptor (core) instead of
interceptor:core, rising/declining instead of ↑ Rising/↓ Declining 5. Build + test against angular-spotify with 3 commands

Refs gets a tree graph visualization inside the box showing the symbol as root with ├─/└─ branches to each reference with preview snippets.

─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Ready to code?
Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
CLI Polish + Bug Fixes Plan

Context

The CLI formatters for search, patterns, and refs were implemented in the previous session but have problems:

- All use Record<string, unknown> with unsafe as casts — no type safety, unreadable code
- Output is functional but not human-readable (interceptor:core, ↑ Rising mean nothing to humans)
- providedIn: unknown bug — @Injectable({ providedIn: 'root' }) IS in the source but lost during chunking
- "Standalone" pattern name is too terse and the tag in chunking is redundant noise
- No visual framing — output looks like debug dumps, not a polished CLI tool

This blocks launch screenshots: the CLI output needs to look professional enough for Reddit/HN posts.

---

Files to modify

┌────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ File │ Changes │
├────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/tools/types.ts │ Add response interfaces (SearchResponse, PatternResponse, RefsResponse, etc.) │
├────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/cli.ts │ Refactor formatters: use types, add ASCII box art, human-readable labels, graph viz for refs │
├────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/analyzers/angular/index.ts │ "Standalone" → "Standalone component" (lines 308, 313) + fix providedIn summary (line 1038) │
├────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/utils/chunking.ts │ Remove standalone tag (line 249-251) + spread component.metadata to fix providedIn pipeline (line 111) │
└────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────┘

---

Step 1: Add response type interfaces

File: src/tools/types.ts

Add these interfaces alongside existing DecisionCard:

// --- Search response types ---
export interface SearchQuality {
status: 'ok' | 'low_confidence';
confidence: number | string;
hint?: string;
}

export interface SearchResultItem {
file: string; // "path:startLine-endLine"
summary: string;
score: number;
type?: string; // "componentType:layer"
trend?: 'Rising' | 'Declining';
patternWarning?: string;
relationships?: {
importedByCount?: number;
hasTests?: boolean;
};
hints?: {
callers?: string[];
consumers?: string[];
tests?: string[];
};
snippet?: string;
}

export interface SearchResponse {
status: string;
searchQuality: SearchQuality;
preflight?: DecisionCard;
results: SearchResultItem[];
totalResults: number;
relatedMemories?: string[];
}

// --- Pattern response types ---
export interface PatternEntry {
name: string;
frequency: string;
trend?: string;
adoption?: string;
}

export interface PatternCategory {
primary: PatternEntry;
alsoDetected?: PatternEntry[];
}

export interface PatternConflict {
category: string;
primary: { name: string; adoption: string };
alternative: { name: string; adoption: string };
}

export interface GoldenFile {
file: string;
score: number;
}

export interface PatternResponse {
patterns: Record<string, PatternCategory>;
goldenFiles?: GoldenFile[];
memories?: Array<{ type: string; memory: string }>;
conflicts?: PatternConflict[];
}

// --- Refs response types ---
export interface RefsUsage {
file: string;
line: number;
preview: string;
}

export interface RefsResponse {
symbol: string;
usageCount: number;
confidence: string;
usages: RefsUsage[];
}

---

Step 2: Fix providedIn extraction pipeline

Root cause: createComponentChunks in src/utils/chunking.ts line 111 spreads ...metadata (file-level: framework, layer, etc.) but never includes
component.metadata (per-component: providedIn, selector, isStandalone, etc.). The decorator parser extracts providedIn: 'root' correctly, but it's lost
here.

File: src/utils/chunking.ts line 111

Change:
metadata: {
...metadata,
componentName: component.name,

To:
metadata: {
...component.metadata, // per-component: providedIn, selector, isStandalone, etc.
...metadata, // file-level: framework, layer (overrides on conflict)
componentName: component.name,

Order matters: component.metadata first (provides providedIn, selector), file-level metadata second (framework, layer override), explicit fields last  
 (always win).

Also in same file, lines 249-251 — remove standalone tag:
// DELETE these 3 lines:
if (metadata?.isStandalone) {
tags.push('standalone');
}

---

Step 3: Fix "Standalone" label + providedIn summary

File: src/analyzers/angular/index.ts

Lines 308, 313 — rename pattern:
// Both occurrences:
detectedPatterns.push({ category: 'componentStyle', name: 'Standalone component' });

Line 1038 — fix summary to skip showing when not available:

Change:
const providedIn = metadata?.providedIn || 'unknown';
const methods = this.extractPublicMethods(content);
return `Angular service '${className}' (providedIn: ${providedIn})${
   methods ? ` providing ${methods}` : ''
 }.`;

To:
const providedIn = metadata?.providedIn;
const methods = this.extractPublicMethods(content);
const scope = providedIn ? ` (${providedIn})` : '';
return `Angular service '${className}'${scope}${
   methods ? ` providing ${methods}` : ''
 }.`;

Result: Angular service 'AuthStore' (root) providing getToken. when present, Angular service 'AuthStore' providing getToken. when not.

---

Step 4: Refactor CLI formatters with types + ASCII art

File: src/cli.ts

4a. Import types, replace Record<string, unknown>

Add imports from ./tools/types.js and cast parsed JSON to proper types:

import type {
SearchResponse, SearchResultItem, SearchQuality,
PatternResponse, PatternCategory, PatternEntry, GoldenFile, PatternConflict,
RefsResponse, RefsUsage, DecisionCard
} from './tools/types.js';

Change formatJson:
function formatJson(json: string, useJson: boolean, command?: string, rootPath?: string, query?: string, intent?: string): void {
// ... parse json ...
switch (command) {
case 'patterns':
formatPatterns(data as PatternResponse);
break;
case 'search':
formatSearch(data as SearchResponse, rootPath ?? '', query, intent);
break;
case 'refs':
formatRefs(data as RefsResponse, rootPath ?? '');
break;
}
}

All formatter signatures change from (data: Record<string, unknown>, ...) to typed versions.

4b. Add box-drawing helper

function drawBox(title: string, lines: string[], width: number = 60): string[] {
const output: string[] = [];
const inner = width - 4; // 2 for "│ " + 2 for " │"
const titleLine = `┌─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 5))}┐`;
output.push(titleLine);
for (const line of lines) {
const padded = line.length <= inner ? line + ' '.repeat(inner - line.length) : line.slice(0, inner);
output.push(`│ ${padded} │`);
}
output.push(`└${'─'.repeat(width - 2)}┘`);
return output;
}

4c. Human-readable trend + type helpers

Replace trendArrow():
function formatTrend(trend?: string): string {
if (trend === 'Rising') return 'rising';
if (trend === 'Declining') return 'declining';
return '';
}

Add type formatter:
function formatType(type?: string): string {
if (!type) return '';
// "interceptor:core" → "interceptor (core)"
const [compType, layer] = type.split(':');
return layer ? `${compType} (${layer})` : compType;
}

4d. formatSearch — box around preflight, clean results

Target output:
┌─ Search: "how is auth handled" ─── intent: edit ──┐
│ Quality: ok (1.0) │
│ Ready to edit: YES │
│ │
│ Patterns: │
│ ✓ Standalone component — 100% │
│ ✗ Constructor injection — 3% (declining) │
│ │
│ Best example: src/lib/card.component.ts │
│ Callers: 3/5 in results │
└────────────────────────────────────────────────────┘

1.  auth.interceptor.ts:9-42
    score: 1.41 | interceptor (core) | rising
    Angular HTTP interceptor 'AuthInterceptor'
    callers: app.module.ts, boot.ts

Memories:
refactor: handle refresh token and first time login (0.72)

Implementation:

- Build array of lines for the box content (quality, ready, patterns, best example, impact, whatWouldHelp)
- Pass to drawBox() with title Search: "${query}" ─── intent: ${intent}
- Results printed below as numbered list with pipe-separated metadata: score: X | type (layer) | trend
- callers: line only when hints.callers exists
- Memories section at bottom

4e. formatPatterns — boxed sections

Target output:
┌─ Team Patterns ────────────────────────────────────┐
│ │
│ DEPENDENCY INJECTION │
│ Constructor injection 84% declining │
│ inject() function 16% stable │
│ │
│ COMPONENT STYLE │
│ Standalone component 100% stable │
│ │
│ GOLDEN FILES │
│ src/lib/card.component.ts 4 patterns │
│ src/lib/playlist-list.component.ts 3 patterns │
│ │
│ CONFLICTS │
│ DI: Constructor (84%) vs inject() (16%) │
│ │
│ MEMORIES (from git) │
│ [decision] Use inject() for new services │
│ │
└────────────────────────────────────────────────────┘

4f. formatRefs — tree graph visualization

Target output:
┌─ AuthStore ─── 10 references ─── syntactic ────────┐
│ │
│ AuthStore │
│ │ │
│ ├─ auth.interceptor.ts:15 │
│ │ import { AuthStore } from '../store/...' │
│ │ │
│ ├─ auth.guard.ts:8 │
│ │ constructor(private auth: AuthStore) │
│ │ │
│ ├─ login.component.ts:23 │
│ │ this.authStore.login() │
│ │ │
│ └─ profile.component.ts:31 │
│ this.authStore.getProfile() │
│ │
└────────────────────────────────────────────────────┘

Implementation:

- Box header: SymbolName ─── N references ─── confidence
- Inside the box: tree structure using ├─, │, └─ chars
- Each node: file:line on first line, first line of preview indented below
- Last node uses └─ instead of ├─

4g. Thread query/intent to formatSearch

In handleCliCommand, capture query and intent from flags and pass them through formatJson:
formatJson(extractText(result), useJson, command, ctx.rootPath, flags['query'] as string, flags['intent'] as string);

---

Step 5: Build and test

npm run build

Test queries (run against angular-spotify):

"Good" query — rich preflight, ready: YES:
CODEBASE_ROOT=/c/Users/bitaz/Repos/angular-spotify node dist/index.js search --query "how is auth handled" --intent edit 2>/dev/null

Query showing graph — refs:
CODEBASE_ROOT=/c/Users/bitaz/Repos/angular-spotify node dist/index.js refs --symbol "AuthStore" 2>/dev/null

Patterns overview:
CODEBASE_ROOT=/c/Users/bitaz/Repos/angular-spotify node dist/index.js patterns 2>/dev/null

Run existing tests:
npm test

After confirming output is screenshot-worthy, user takes screenshots and proceeds with the launch sequence from docs/MARKETING-AND-VISUALS.md.

---

What NOT to change

- --json flag output must remain untouched (raw JSON)
- Don't restructure formatJson dispatch logic — just update signatures and bodies
- Don't modify the MCP tool handlers or the response shapes in search-codebase.ts
- Don't touch metadata, status, style-guide, or cycles formatters — those stay as JSON
- Don't add color/ANSI codes — keep it terminal-safe and screenshot-friendly
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌

Claude has written up a plan and is ready to execute. Would you like to proceed?
