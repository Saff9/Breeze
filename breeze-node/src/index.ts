// Entry point.

import * as fs from "fs";
import * as path from "path";
import { tokenize } from "./lexer";
import { Parser } from "./parser";
import { Interpreter, InterpreterOptions, valueToString } from "./interpreter";
import { BreezeError } from "./types";

export const VERSION = "1.2.0";

export interface BreezeResult {
  output: string[];
  error: string | null;
  errorLine: number | null;
  errorFormatted: string | null;
}

export interface RunOptions {
  cwd?: string;
  // When true, run the program with sandbox builtins disabled
  // (fs, env, python, http.get, http.post). http.listen stays available.
  sandbox?: boolean;
}

function formatError(err: BreezeError, source: string): string {
  if (err.line <= 0) {
    return `Error: ${err.message}`;
  }
  const lines = source.split("\n");
  const idx = err.line - 1;
  if (idx < 0 || idx >= lines.length) {
    return `Error (line ${err.line}): ${err.message}`;
  }
  const srcLine = lines[idx];
  const lineNum = String(err.line);
  const pad = " ".repeat(lineNum.length);

  // Draw caret pointing to column
  const col = (err as BreezeError & { col?: number }).col;
  const caretLine =
    col != null && col > 0
      ? `\n  ${pad} | ${" ".repeat(col - 1)}^`
      : "";

  return [
    `Error (line ${err.line}): ${err.message}`,
    `  ${lineNum} | ${srcLine}${caretLine}`,
  ].join("\n");
}

export function run(source: string, options: RunOptions = {}): BreezeResult {
  try {
    const tokens = tokenize(source);
    const parser = new Parser(tokens);
    const program = parser.parse();
    const interpreter = new Interpreter({
      cwd: options.cwd,
      sandbox: options.sandbox,
    });
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

// The file's directory becomes the cwd used to resolve relative imports.
export function runFile(filePath: string, options: RunOptions = {}): BreezeResult {
  try {
    const abs = path.resolve(filePath);
    const source = fs.readFileSync(abs, "utf8");
    return run(source, {
      cwd: path.dirname(abs),
      sandbox: options.sandbox,
    });
  } catch (e) {
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
export type { InterpreterOptions } from "./interpreter";
export { BreezeError } from "./types";
export type {
  RuntimeValue,
  BreezeFunction,
  BuiltinFunction,
  ObjectValue,
  Token,
  Program,
  Statement,
  Expression,
} from "./types";
export { EXAMPLES } from "./examples";
export type { BreezeExample } from "./examples";
export { highlightBreeze } from "./highlighter";
