// Syntax highlighter.

const KEYWORDS = new Set([
  "show", "if", "else", "repeat", "from", "to", "for", "in",
  "func", "return", "true", "false", "none", "and", "or", "not",
  "import", "export",
]);

const BUILTINS = new Set([
  "len", "text", "number", "upper", "lower", "abs", "round",
  "floor", "ceil", "random", "sum", "min", "max", "push",
  "range", "type", "join",
]);

const NAMESPACES = new Set(["http", "json", "fs", "env", "time", "math"]);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function highlightBreeze(code: string): string {
  let result = "";
  let i = 0;
  while (i < code.length) {
    const c = code[i];

    if (c === "#") {
      let comment = "";
      while (i < code.length && code[i] !== "\n") {
        comment += code[i];
        i++;
      }
      result += `<span class="tok-comment">${esc(comment)}</span>`;
      continue;
    }

    if (c === '"' || c === "'") {
      const q = c;
      let str = c;
      i++;
      while (i < code.length && code[i] !== q) {
        if (code[i] === "\\" && i + 1 < code.length) {
          str += code[i] + code[i + 1];
          i += 2;
        } else {
          str += code[i];
          i++;
        }
      }
      if (i < code.length) {
        str += code[i];
        i++;
      }
      result += `<span class="tok-string">${esc(str)}</span>`;
      continue;
    }

    if (/[0-9]/.test(c)) {
      let num = "";
      while (i < code.length && /[0-9.]/.test(code[i])) {
        num += code[i];
        i++;
      }
      result += `<span class="tok-number">${esc(num)}</span>`;
      continue;
    }

    if (/[a-zA-Z_]/.test(c)) {
      let ident = "";
      while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) {
        ident += code[i];
        i++;
      }
      let j = i;
      while (j < code.length && code[j] === " ") j++;
      const isCall = code[j] === "(";

      if (KEYWORDS.has(ident)) {
        result += `<span class="tok-keyword">${esc(ident)}</span>`;
      } else if (NAMESPACES.has(ident)) {
        result += `<span class="tok-namespace">${esc(ident)}</span>`;
      } else if (BUILTINS.has(ident) || isCall) {
        result += `<span class="tok-func">${esc(ident)}</span>`;
      } else {
        result += `<span class="tok-ident">${esc(ident)}</span>`;
      }
      continue;
    }

    const two = code.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=") {
      result += `<span class="tok-op">${esc(two)}</span>`;
      i += 2;
      continue;
    }
    if ("+-*/%<>=".includes(c)) {
      result += `<span class="tok-op">${esc(c)}</span>`;
      i++;
      continue;
    }

    if (c === ":" || c === "," || c === "(" || c === ")" || c === "[" || c === "]" || c === "{" || c === "}" || c === ".") {
      result += `<span class="tok-punct">${esc(c)}</span>`;
      i++;
      continue;
    }

    result += esc(c);
    i++;
  }
  return result;
}
