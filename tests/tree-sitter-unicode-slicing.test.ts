import { describe, expect, it } from 'vitest';
import { extractTreeSitterSymbols } from '../src/utils/tree-sitter';

describe('Tree-sitter Unicode slicing regression', () => {
  it('extracts full symbol content when Unicode appears before symbol', async () => {
    const source = [
      "const banner = 'launch 🚀';",
      '',
      'export function greeting(name: string): string {',
      '  return `hi ${name}`;',
      '}'
    ].join('\n');

    const extracted = await extractTreeSitterSymbols(source, 'typescript');
    expect(extracted).not.toBeNull();

    const greeting = extracted!.symbols.find((symbol) => symbol.name === 'greeting');
    expect(greeting).toBeDefined();
    expect(greeting!.content).toContain('export function greeting(name: string): string {');
    expect(greeting!.content).toContain('return `hi ${name}`;');
  });
});
