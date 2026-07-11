// Breeze Language — browser-safe entry point for the web playground.
// Re-exports the interpreter pieces that work without Node's fs module.

import { tokenize } from "./lexer";
import { Parser } from "./parser";
import { Interpreter, valueToString } from "./interpreter";
import { BreezeError } from "./types";

export interface BreezeResult {
  output: string[];
  error: string | null;
  errorLine: number | null;
  errorFormatted: string | null;
}

function formatError(err: BreezeError, source: string): string {
  if (err.line <= 0) return `Error: ${err.message}`;
  const lines = source.split("\n");
  const idx = err.line - 1;
  if (idx < 0 || idx >= lines.length) return `Error (line ${err.line}): ${err.message}`;
  const srcLine = lines[idx];
  const pad = " ".repeat(String(err.line).length);
  return [
    `Error (line ${err.line}): ${err.message}`,
    `  ${pad} | ${srcLine}`,
  ].join("\n");
}

export function runBreeze(source: string): BreezeResult {
  try {
    const tokens = tokenize(source);
    const parser = new Parser(tokens);
    const program = parser.parse();
    // Browser-safe: no cwd, no fs. Imports won't resolve in the playground.
    const interpreter = new Interpreter({});
    const output = interpreter.run(program);
    return { output, error: null, errorLine: null, errorFormatted: null };
  } catch (e) {
    if (e instanceof BreezeError) {
      return {
        output: [],
        error: e.message,
        errorLine: e.line || null,
        errorFormatted: formatError(e, source),
      };
    }
    return {
      output: [],
      error: e instanceof Error ? e.message : String(e),
      errorLine: null,
      errorFormatted: e instanceof Error ? e.message : String(e),
    };
  }
}

export { tokenize } from "./lexer";
export { Parser } from "./parser";
export { Interpreter, valueToString } from "./interpreter";
export { BreezeError } from "./types";
export { EXAMPLES } from "./examples";
export type { BreezeExample } from "./examples";
export { highlightBreeze } from "./highlighter";
