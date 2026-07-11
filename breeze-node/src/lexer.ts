// Lexer.

import { BreezeError, Token } from "./types";

const KEYWORDS = new Set([
  "show",
  "if",
  "elif",
  "else",
  "while",
  "repeat",
  "from",
  "to",
  "for",
  "in",
  "func",
  "return",
  "break",
  "continue",
  "try",
  "catch",
  "true",
  "false",
  "none",
  "and",
  "or",
  "not",
  "import",
  "export",
]);

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}
function isAlpha(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
}
function isAlphaNum(c: string): boolean {
  return isAlpha(c) || isDigit(c);
}

function tokenizeLine(
  src: string,
  line: number,
  tokens: Token[]
): void {
  let i = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === " " || c === "\t") {
      i++;
      continue;
    }

    if (c === "#") {
      break;
    }

    // Single-quoted strings are literal (no interpolation).
    if (c === '"' || c === "'") {
      const quote = c;
      const interpolate = quote === '"';
      const parts: { text: string; expr?: string }[] = [];
      let current = "";
      let hasExpr = false;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < src.length) {
          const next = src[i + 1];
          if (next === "n") current += "\n";
          else if (next === "t") current += "\t";
          else if (next === "r") current += "\r";
          else if (next === "\\") current += "\\";
          else if (next === quote) current += quote;
          else if (interpolate && next === "{") current += "{";
          else if (interpolate && next === "}") current += "}";
          else current += next;
          i += 2;
        } else if (interpolate && src[i] === "{") {
          parts.push({ text: current });
          current = "";
          hasExpr = true;
          i++;
          let depth = 1;
          let expr = "";
          while (i < src.length && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") {
              depth--;
              if (depth === 0) break;
            }
            expr += src[i];
            i++;
          }
          if (i >= src.length) {
            throw new BreezeError(
              "Unterminated interpolation — missing closing '}' in string",
              line
            );
          }
          i++;
          parts.push({ text: "", expr });
        } else {
          current += src[i];
          i++;
        }
      }
      if (i >= src.length) {
        throw new BreezeError("Unterminated string — missing closing quote", line);
      }
      i++;
      if (interpolate && hasExpr) {
        parts.push({ text: current });
        tokens.push({ type: "STRING", value: parts, line });
      } else if (interpolate) {
        tokens.push({ type: "STRING", value: current, line });
      } else {
        tokens.push({ type: "STRING", value: current, line });
      }
      continue;
    }

    if (isDigit(c) || (c === "." && i + 1 < src.length && isDigit(src[i + 1]))) {
      let num = "";
      let hasDot = false;
      while (i < src.length && (isDigit(src[i]) || src[i] === ".")) {
        if (src[i] === ".") {
          // Stop on second dot or when followed by a non-digit (member access).
          if (hasDot) break;
          if (i + 1 < src.length && !isDigit(src[i + 1])) break;
          hasDot = true;
        }
        num += src[i];
        i++;
      }
      const val = hasDot ? parseFloat(num) : parseInt(num, 10);
      tokens.push({ type: "NUMBER", value: val, line });
      continue;
    }

    if (isAlpha(c)) {
      let ident = "";
      while (i < src.length && isAlphaNum(src[i])) {
        ident += src[i];
        i++;
      }
      if (KEYWORDS.has(ident)) {
        tokens.push({ type: "KEYWORD", value: ident, line });
      } else {
        tokens.push({ type: "IDENT", value: ident, line });
      }
      continue;
    }

    const two = src.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=") {
      tokens.push({ type: "OP", value: two, line });
      i += 2;
      continue;
    }

    if ("+-*/%<>=".includes(c)) {
      tokens.push({ type: "OP", value: c, line });
      i++;
      continue;
    }

    if (c === "(") {
      tokens.push({ type: "LPAREN", line });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "RPAREN", line });
      i++;
      continue;
    }
    if (c === "[") {
      tokens.push({ type: "LBRACKET", line });
      i++;
      continue;
    }
    if (c === "]") {
      tokens.push({ type: "RBRACKET", line });
      i++;
      continue;
    }
    if (c === "{") {
      tokens.push({ type: "LBRACE", line });
      i++;
      continue;
    }
    if (c === "}") {
      tokens.push({ type: "RBRACE", line });
      i++;
      continue;
    }
    if (c === ":") {
      tokens.push({ type: "COLON", line });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ type: "COMMA", line });
      i++;
      continue;
    }
    if (c === ".") {
      tokens.push({ type: "DOT", line });
      i++;
      continue;
    }

    throw new BreezeError(`Unexpected character '${c}'`, line);
  }
}

// Used by the parser to re-tokenize interpolated expression segments
// like `name` in `"Hello {name}"`.
export function tokenizeExpression(src: string, line: number): Token[] {
  const tokens: Token[] = [];
  tokenizeLine(src, line, tokens);
  tokens.push({ type: "EOF", line });
  return tokens;
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.replace(/\t/g, "  ").split("\n");
  const indentStack: number[] = [0];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const rawLine = lines[lineNum];
    const trimmed = rawLine.trim();
    const lineNo = lineNum + 1;

    // Skip blank lines and comment-only lines: they don't affect indentation.
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const indent = rawLine.length - rawLine.trimStart().length;
    const current = indentStack[indentStack.length - 1];

    if (indent > current) {
      indentStack.push(indent);
      tokens.push({ type: "INDENT", line: lineNo });
    } else if (indent < current) {
      while (
        indentStack.length > 1 &&
        indentStack[indentStack.length - 1] > indent
      ) {
        indentStack.pop();
        tokens.push({ type: "DEDENT", line: lineNo });
      }
      if (indentStack[indentStack.length - 1] !== indent) {
        throw new BreezeError(
          "Inconsistent indentation — does not match any previous level",
          lineNo
        );
      }
    }

    tokenizeLine(rawLine.slice(indent), lineNo, tokens);

    tokens.push({ type: "NEWLINE", line: lineNo });
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ type: "DEDENT", line: lines.length });
  }

  tokens.push({ type: "EOF", line: lines.length });
  return tokens;
}
