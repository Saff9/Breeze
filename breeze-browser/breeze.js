/*!
 * Breeze Browser Runtime v1.2.0
 * =============================
 * The easiest programming language, running in the browser.
 *
 * Drop this file into any HTML page and write Breeze:
 *
 *   <script src="breeze.js"></script>
 *   <script type="text/breeze">
 *     name = "World"
 *     show "Hello, {name}!"
 *     repeat i from 1 to 3:
 *       show "Count: {i}"
 *   </script>
 *
 * Or use the API:
 *
 *   <script src="breeze.js"></script>
 *   <script>
 *     const result = Breeze.run('show 1 + 2');
 *     console.log(result.output);  // ["3"]
 *   </script>
 *
 * Route `show` output to a page element:
 *
 *   <div id="output"></div>
 *   <script>
 *     Breeze.run('show "Hi!"  repeat i from 1 to 5: show i', "output");
 *   </script>
 *
 * License: MIT
 */
(function (global) {
  "use strict";

  // ===========================================================================
  // 1. Errors
  // ===========================================================================
  class BreezeError extends Error {
    constructor(message, line) {
      super(message);
      this.name = "BreezeError";
      this.line = line || 0;
    }
  }

  // ===========================================================================
  // 2. Lexer
  // ===========================================================================
  const KEYWORDS = new Set([
    "show", "if", "elif", "else", "while", "repeat", "from", "to", "for", "in",
    "func", "return", "break", "continue", "true", "false", "none", "and", "or",
    "not", "import", "export",
  ]);

  function isDigit(c) { return c >= "0" && c <= "9"; }
  function isAlpha(c) { return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_"; }
  function isAlphaNum(c) { return isAlpha(c) || isDigit(c); }

  function tokenizeLine(src, line, tokens) {
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === " " || c === "\t") { i++; continue; }
      if (c === "#") break;

      // Strings (with interpolation in double quotes)
      if (c === '"' || c === "'") {
        const quote = c;
        const interpolate = quote === '"';
        const parts = [];
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
              else if (src[i] === "}") { depth--; if (depth === 0) break; }
              expr += src[i];
              i++;
            }
            if (i >= src.length) throw new BreezeError("Unterminated interpolation — missing closing '}'", line);
            i++;
            parts.push({ text: "", expr: expr });
          } else {
            current += src[i];
            i++;
          }
        }
        if (i >= src.length) throw new BreezeError("Unterminated string — missing closing quote", line);
        i++;
        if (interpolate && hasExpr) {
          parts.push({ text: current });
          tokens.push({ type: "STRING", value: parts, line: line });
        } else {
          tokens.push({ type: "STRING", value: current, line: line });
        }
        continue;
      }

      // Numbers
      if (isDigit(c) || (c === "." && i + 1 < src.length && isDigit(src[i + 1]))) {
        let num = "";
        let hasDot = false;
        while (i < src.length && (isDigit(src[i]) || src[i] === ".")) {
          if (src[i] === ".") {
            if (hasDot) break;
            if (i + 1 < src.length && !isDigit(src[i + 1])) break;
            hasDot = true;
          }
          num += src[i];
          i++;
        }
        tokens.push({ type: "NUMBER", value: hasDot ? parseFloat(num) : parseInt(num, 10), line: line });
        continue;
      }

      // Identifiers / keywords
      if (isAlpha(c)) {
        let ident = "";
        while (i < src.length && isAlphaNum(src[i])) { ident += src[i]; i++; }
        tokens.push(KEYWORDS.has(ident) ? { type: "KEYWORD", value: ident, line: line } : { type: "IDENT", value: ident, line: line });
        continue;
      }

      // Two-char operators
      const two = src.slice(i, i + 2);
      if (two === "==" || two === "!=" || two === "<=" || two === ">=") {
        tokens.push({ type: "OP", value: two, line: line });
        i += 2;
        continue;
      }
      if ("+-*/%<>=".includes(c)) { tokens.push({ type: "OP", value: c, line: line }); i++; continue; }

      // Punctuation
      if (c === "(") { tokens.push({ type: "LPAREN", line: line }); i++; continue; }
      if (c === ")") { tokens.push({ type: "RPAREN", line: line }); i++; continue; }
      if (c === "[") { tokens.push({ type: "LBRACKET", line: line }); i++; continue; }
      if (c === "]") { tokens.push({ type: "RBRACKET", line: line }); i++; continue; }
      if (c === "{") { tokens.push({ type: "LBRACE", line: line }); i++; continue; }
      if (c === "}") { tokens.push({ type: "RBRACE", line: line }); i++; continue; }
      if (c === ":") { tokens.push({ type: "COLON", line: line }); i++; continue; }
      if (c === ",") { tokens.push({ type: "COMMA", line: line }); i++; continue; }
      if (c === ".") { tokens.push({ type: "DOT", line: line }); i++; continue; }
      throw new BreezeError("Unexpected character '" + c + "'", line);
    }
  }

  function tokenizeExpression(src, line) {
    const tokens = [];
    tokenizeLine(src, line, tokens);
    tokens.push({ type: "EOF", line: line });
    return tokens;
  }

  function tokenize(source) {
    const tokens = [];
    const lines = source.replace(/\t/g, "  ").split("\n");
    const indentStack = [0];
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const rawLine = lines[lineNum];
      const trimmed = rawLine.trim();
      const lineNo = lineNum + 1;
      if (trimmed === "" || trimmed.startsWith("#")) continue;
      const indent = rawLine.length - rawLine.trimStart().length;
      const current = indentStack[indentStack.length - 1];
      if (indent > current) { indentStack.push(indent); tokens.push({ type: "INDENT", line: lineNo }); }
      else if (indent < current) {
        while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indent) {
          indentStack.pop();
          tokens.push({ type: "DEDENT", line: lineNo });
        }
        if (indentStack[indentStack.length - 1] !== indent) {
          throw new BreezeError("Inconsistent indentation", lineNo);
        }
      }
      tokenizeLine(rawLine.slice(indent), lineNo, tokens);
      tokens.push({ type: "NEWLINE", line: lineNo });
    }
    while (indentStack.length > 1) { indentStack.pop(); tokens.push({ type: "DEDENT", line: lines.length }); }
    tokens.push({ type: "EOF", line: lines.length });
    return tokens;
  }

  // ===========================================================================
  // 3. Parser (recursive descent)
  // ===========================================================================
  class Parser {
    constructor(tokens) { this.tokens = tokens; this.pos = 0; }
    peek(off) { return this.tokens[Math.min(this.pos + (off || 0), this.tokens.length - 1)]; }
    current() { return this.peek(0); }
    advance() { const t = this.tokens[this.pos]; if (this.pos < this.tokens.length - 1) this.pos++; return t; }
    isEOF() { return this.current().type === "EOF"; }
    isKW(kw) { const t = this.current(); return t.type === "KEYWORD" && t.value === kw; }
    isOP(op) { const t = this.current(); return t.type === "OP" && t.value === op; }
    skipNewlines() { while (this.current().type === "NEWLINE") this.pos++; }
    skipTrivia() {
      const t = this.current();
      while (t.type === "NEWLINE" || t.type === "INDENT" || t.type === "DEDENT") { this.pos++; }
    }
    is(type) { return this.current().type === type; }
    expect(type, line) {
      if (!this.is(type)) {
        const t = this.current();
        throw new BreezeError("Expected " + type + " but found " + t.type.toLowerCase(), line || t.line);
      }
      return this.advance();
    }
    expectKW(kw) {
      if (!this.isKW(kw)) { throw new BreezeError("Expected '" + kw + "'", this.current().line); }
      return this.advance();
    }

    parse() {
      const body = [];
      this.skipNewlines();
      while (!this.isEOF()) { body.push(this.parseStatement()); this.skipNewlines(); }
      return { type: "Program", body: body };
    }

    parseStatement() {
      const t = this.current();
      if (t.type === "KEYWORD") {
        switch (t.value) {
          case "show": return this.parseShow();
          case "if": return this.parseIf();
          case "while": return this.parseWhile();
          case "repeat": return this.parseRepeat();
          case "for": return this.parseFor();
          case "return": return this.parseReturn();
          case "break": { this.advance(); return { type: "Break", line: t.line }; }
          case "continue": { this.advance(); return { type: "Continue", line: t.line }; }
          case "func":
            if (this.peek(1).type === "IDENT") return this.parseFunc();
            break;
        }
      }
      const expr = this.parseExpression();
      if (this.isOP("=")) {
        const tok = this.advance();
        const value = this.parseExpression();
        return { type: "Assignment", target: expr, value: value, line: tok.line };
      }
      return { type: "ExpressionStatement", expression: expr, line: t.line };
    }

    parseShow() {
      const tok = this.expectKW("show");
      const args = [this.parseExpression()];
      while (this.is("COMMA")) { this.advance(); args.push(this.parseExpression()); }
      return { type: "Show", args: args, line: tok.line };
    }

    parseIf() {
      const tok = this.expectKW("if");
      const test = this.parseExpression();
      this.expect("COLON", tok.line);
      const consequent = this.parseBlockOrInline();
      const elifs = [];
      let alternate = [];
      while (this.isKW("elif")) {
        this.advance();
        const elifTest = this.parseExpression();
        this.expect("COLON");
        elifs.push({ test: elifTest, body: this.parseBlockOrInline() });
      }
      if (this.isKW("else")) { this.advance(); this.expect("COLON"); alternate = this.parseBlockOrInline(); }
      return { type: "If", test: test, consequent: consequent, alternate: alternate, elifs: elifs, line: tok.line };
    }

    parseWhile() {
      const tok = this.expectKW("while");
      const test = this.parseExpression();
      this.expect("COLON", tok.line);
      return { type: "While", test: test, body: this.parseBlockOrInline(), line: tok.line };
    }

    parseRepeat() {
      const tok = this.expectKW("repeat");
      if (this.peek().type === "IDENT" && this.peek(1).type === "KEYWORD" && this.peek(1).value === "from") {
        const varTok = this.expect("IDENT");
        this.expectKW("from");
        const from = this.parseExpression();
        this.expectKW("to");
        const to = this.parseExpression();
        this.expect("COLON", tok.line);
        return { type: "RepeatRange", variable: varTok.value, from: from, to: to, body: this.parseBlockOrInline(), line: tok.line };
      }
      const count = this.parseExpression();
      this.expect("COLON", tok.line);
      return { type: "Repeat", count: count, body: this.parseBlockOrInline(), line: tok.line };
    }

    parseFor() {
      const tok = this.expectKW("for");
      const varTok = this.expect("IDENT");
      this.expectKW("in");
      const iterable = this.parseExpression();
      this.expect("COLON", tok.line);
      return { type: "For", variable: varTok.value, iterable: iterable, body: this.parseBlockOrInline(), line: tok.line };
    }

    parseFunc() {
      const tok = this.expectKW("func");
      const nameTok = this.expect("IDENT");
      this.expect("LPAREN", tok.line);
      const params = [];
      if (!this.is("RPAREN")) {
        params.push(this.expect("IDENT").value);
        while (this.is("COMMA")) { this.advance(); params.push(this.expect("IDENT").value); }
      }
      this.expect("RPAREN", tok.line);
      this.expect("COLON", tok.line);
      return { type: "Func", name: nameTok.value, params: params, body: this.parseBlockOrInline(), line: tok.line };
    }

    parseReturn() {
      const tok = this.expectKW("return");
      if (this.is("NEWLINE") || this.is("DEDENT") || this.is("EOF")) return { type: "Return", value: null, line: tok.line };
      return { type: "Return", value: this.parseExpression(), line: tok.line };
    }

    parseBlockOrInline() {
      if (this.current().type !== "NEWLINE") return [this.parseStatement()];
      this.expect("NEWLINE");
      this.skipNewlines();
      this.expect("INDENT");
      const stmts = [];
      this.skipNewlines();
      while (this.current().type !== "DEDENT" && !this.isEOF()) { stmts.push(this.parseStatement()); this.skipNewlines(); }
      if (!this.isEOF()) this.expect("DEDENT");
      return stmts;
    }

    parseExpression() { return this.parseOr(); }
    parseOr() { let l = this.parseAnd(); while (this.isKW("or")) { const t = this.advance(); l = { type: "Binary", operator: "or", left: l, right: this.parseAnd(), line: t.line }; } return l; }
    parseAnd() { let l = this.parseNot(); while (this.isKW("and")) { const t = this.advance(); l = { type: "Binary", operator: "and", left: l, right: this.parseNot(), line: t.line }; } return l; }
    parseNot() { if (this.isKW("not")) { const t = this.advance(); return { type: "Unary", operator: "not", operand: this.parseNot(), line: t.line }; } return this.parseComparison(); }
    parseComparison() {
      let l = this.parseAddition();
      while (["==", "!=", "<", ">", "<=", ">="].includes((this.current().value))) {
        if (this.current().type !== "OP") break;
        const t = this.advance(); const r = this.parseAddition();
        l = { type: "Binary", operator: t.value, left: l, right: r, line: t.line };
      }
      return l;
    }
    parseAddition() {
      let l = this.parseMultiplication();
      while (this.isOP("+") || this.isOP("-")) { const t = this.advance(); l = { type: "Binary", operator: t.value, left: l, right: this.parseMultiplication(), line: t.line }; }
      return l;
    }
    parseMultiplication() {
      let l = this.parseUnary();
      while (this.isOP("*") || this.isOP("/") || this.isOP("%")) { const t = this.advance(); l = { type: "Binary", operator: t.value, left: l, right: this.parseUnary(), line: t.line }; }
      return l;
    }
    parseUnary() { if (this.isOP("-")) { const t = this.advance(); return { type: "Unary", operator: "-", operand: this.parseUnary(), line: t.line }; } return this.parsePostfix(); }
    parsePostfix() {
      let expr = this.parsePrimary();
      while (true) {
        if (this.is("LPAREN")) {
          const t = this.advance(); const args = []; this.skipTrivia();
          if (!this.is("RPAREN")) { args.push(this.parseExpression()); this.skipTrivia(); while (this.is("COMMA")) { this.advance(); this.skipTrivia(); if (this.is("RPAREN")) break; args.push(this.parseExpression()); this.skipTrivia(); } }
          this.expect("RPAREN", t.line);
          expr = { type: "Call", callee: expr, args: args, line: t.line };
        } else if (this.is("LBRACKET")) {
          const t = this.advance(); this.skipTrivia(); const idx = this.parseExpression(); this.skipTrivia(); this.expect("RBRACKET", t.line);
          expr = { type: "Index", object: expr, index: idx, line: t.line };
        } else if (this.is("DOT")) {
          const t = this.advance(); const prop = this.expect("IDENT");
          expr = { type: "Member", object: expr, property: prop.value, line: t.line };
        } else break;
      }
      return expr;
    }
    parsePrimary() {
      const t = this.current();
      if (t.type === "NUMBER") { this.advance(); return { type: "Literal", value: t.value, line: t.line }; }
      if (t.type === "STRING") {
        this.advance();
        if (typeof t.value === "string") return { type: "Literal", value: t.value, line: t.line };
        const parts = t.value; const exprParts = [];
        for (const p of parts) {
          exprParts.push(p.text);
          if (p.expr !== undefined) {
            const sub = new Parser(tokenizeExpression(p.expr, t.line));
            exprParts.push(sub.parseExpression());
          }
        }
        return { type: "StringInterpolation", parts: exprParts, line: t.line };
      }
      if (t.type === "KEYWORD") {
        if (t.value === "true") { this.advance(); return { type: "Literal", value: true, line: t.line }; }
        if (t.value === "false") { this.advance(); return { type: "Literal", value: false, line: t.line }; }
        if (t.value === "none") { this.advance(); return { type: "Literal", value: null, line: t.line }; }
        if (t.value === "func") {
          this.advance(); this.expect("LPAREN", t.line);
          const params = [];
          if (!this.is("RPAREN")) { params.push(this.expect("IDENT").value); while (this.is("COMMA")) { this.advance(); params.push(this.expect("IDENT").value); } }
          this.expect("RPAREN", t.line); this.expect("COLON", t.line);
          return { type: "FuncLiteral", params: params, body: this.parseBlockOrInline(), line: t.line };
        }
        throw new BreezeError("Unexpected keyword '" + t.value + "' in expression", t.line);
      }
      if (t.type === "IDENT") { this.advance(); return { type: "Identifier", name: t.value, line: t.line }; }
      if (t.type === "LPAREN") { this.advance(); this.skipTrivia(); const e = this.parseExpression(); this.skipTrivia(); this.expect("RPAREN", t.line); return e; }
      if (t.type === "LBRACKET") {
        this.advance(); const els = []; this.skipTrivia();
        if (!this.is("RBRACKET")) { els.push(this.parseExpression()); this.skipTrivia(); while (this.is("COMMA")) { this.advance(); this.skipTrivia(); if (this.is("RBRACKET")) break; els.push(this.parseExpression()); this.skipTrivia(); } }
        this.expect("RBRACKET", t.line);
        return { type: "List", elements: els, line: t.line };
      }
      throw new BreezeError("Unexpected " + t.type.toLowerCase() + " in expression", t.line);
    }
  }

  // ===========================================================================
  // 4. Values & helpers
  // ===========================================================================
  function valueToString(v) {
    if (v === null) return "none";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return Number.isInteger(v) ? v.toString() : v.toString();
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return "[" + v.map(valueToString).join(", ") + "]";
    if (v && typeof v === "object" && v.kind) return "<function " + v.name + ">";
    return String(v);
  }
  function typeName(v) {
    if (v === null) return "none";
    if (typeof v === "boolean") return "boolean";
    if (typeof v === "number") return "number";
    if (typeof v === "string") return "string";
    if (Array.isArray(v)) return "list";
    if (v && typeof v === "object" && v.kind) return "function";
    return "unknown";
  }
  function isTruthy(v) {
    if (v === null) return false;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }
  function toNumber(v, line) {
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "string") { const n = parseFloat(v); if (isNaN(n)) throw new BreezeError('Cannot convert text "' + v + '" to a number', line); return n; }
    throw new BreezeError("Cannot convert " + typeName(v) + " to a number", line);
  }
  function deepEqual(a, b) {
    if (typeof a === "number" && typeof b === "number") return a === b;
    if (typeof a === "string" && typeof b === "string") return a === b;
    if (typeof a === "boolean" && typeof b === "boolean") return a === b;
    if (a === null && b === null) return true;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
    return valueToString(a) === valueToString(b);
  }
  function compare(a, b, line) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
    return toNumber(a, line) - toNumber(b, line);
  }

  // ===========================================================================
  // 5. Environment
  // ===========================================================================
  class Environment {
    constructor(parent) { this.vars = new Map(); this.parent = parent || null; }
    get(name) { if (this.vars.has(name)) return this.vars.get(name); return this.parent ? this.parent.get(name) : undefined; }
    set(name, value) {
      if (this.vars.has(name)) { this.vars.set(name, value); return; }
      if (this.parent && this.parent.has(name)) { this.parent.set(name, value); return; }
      this.vars.set(name, value);
    }
    define(name, value) { this.vars.set(name, value); }
    has(name) { if (this.vars.has(name)) return true; return this.parent ? this.parent.has(name) : false; }
  }

  // ===========================================================================
  // 6. Signals for return/break/continue
  // ===========================================================================
  class ReturnSignal { constructor(value) { this.value = value; } }
  class BreakSignal {}
  class ContinueSignal {}

  // ===========================================================================
  // 7. Built-in functions
  // ===========================================================================
  function makeBuiltin(name, fn) { return [name, { kind: "builtin", name: name, fn: fn }]; }
  function checkArgCount(name, args, n, line) {
    if (args.length !== n) throw new BreezeError(name + "() needs " + n + " value" + (n === 1 ? "" : "s") + " but got " + args.length, line);
  }

  function createBuiltins() {
    const m = new Map([
      makeBuiltin("text", (a, l) => { checkArgCount("text", a, 1, l); return valueToString(a[0]); }),
      makeBuiltin("number", (a, l) => { checkArgCount("number", a, 1, l); return toNumber(a[0], l); }),
      makeBuiltin("len", (a, l) => { checkArgCount("len", a, 1, l); if (typeof a[0] === "string") return a[0].length; if (Array.isArray(a[0])) return a[0].length; throw new BreezeError("len() works on text or lists", l); }),
      makeBuiltin("upper", (a, l) => { checkArgCount("upper", a, 1, l); if (typeof a[0] !== "string") throw new BreezeError("upper() needs text", l); return a[0].toUpperCase(); }),
      makeBuiltin("lower", (a, l) => { checkArgCount("lower", a, 1, l); if (typeof a[0] !== "string") throw new BreezeError("lower() needs text", l); return a[0].toLowerCase(); }),
      makeBuiltin("abs", (a, l) => { checkArgCount("abs", a, 1, l); return Math.abs(toNumber(a[0], l)); }),
      makeBuiltin("round", (a, l) => { checkArgCount("round", a, 1, l); return Math.round(toNumber(a[0], l)); }),
      makeBuiltin("floor", (a, l) => { checkArgCount("floor", a, 1, l); return Math.floor(toNumber(a[0], l)); }),
      makeBuiltin("ceil", (a, l) => { checkArgCount("ceil", a, 1, l); return Math.ceil(toNumber(a[0], l)); }),
      makeBuiltin("random", (a, l) => { checkArgCount("random", a, 2, l); const lo = Math.floor(toNumber(a[0], l)); const hi = Math.floor(toNumber(a[1], l)); return Math.floor(Math.random() * (hi - lo + 1)) + lo; }),
      makeBuiltin("sum", (a, l) => { checkArgCount("sum", a, 1, l); if (!Array.isArray(a[0])) throw new BreezeError("sum() needs a list", l); let t = 0; for (const x of a[0]) t += toNumber(x, l); return t; }),
      makeBuiltin("min", (a, l) => { if (!a.length) throw new BreezeError("min() needs at least one value", l); let r = toNumber(a[0], l); for (let i = 1; i < a.length; i++) { const n = toNumber(a[i], l); if (n < r) r = n; } return r; }),
      makeBuiltin("max", (a, l) => { if (!a.length) throw new BreezeError("max() needs at least one value", l); let r = toNumber(a[0], l); for (let i = 1; i < a.length; i++) { const n = toNumber(a[i], l); if (n > r) r = n; } return r; }),
      makeBuiltin("push", (a, l) => { checkArgCount("push", a, 2, l); if (!Array.isArray(a[0])) throw new BreezeError("push() needs a list first", l); const list = a[0].slice(); list.push(a[1]); return list; }),
      makeBuiltin("range", (a, l) => {
        if (!a.length || a.length > 2) throw new BreezeError("range() needs 1 or 2 numbers", l);
        let s = 0, e = 0; if (a.length === 1) e = toNumber(a[0], l); else { s = toNumber(a[0], l); e = toNumber(a[1], l); }
        const r = []; for (let i = s; i < e; i++) r.push(i); return r;
      }),
      makeBuiltin("type", (a, l) => { checkArgCount("type", a, 1, l); return typeName(a[0]); }),
      makeBuiltin("join", (a, l) => { checkArgCount("join", a, 2, l); if (!Array.isArray(a[0])) throw new BreezeError("join() needs a list first", l); if (typeof a[1] !== "string") throw new BreezeError("join() needs text separator", l); return a[0].map(valueToString).join(a[1]); }),
      makeBuiltin("split", (a, l) => { checkArgCount("split", a, 2, l); if (typeof a[0] !== "string" || typeof a[1] !== "string") throw new BreezeError("split() needs two pieces of text", l); return a[0].split(a[1]); }),
      makeBuiltin("contains", (a, l) => { checkArgCount("contains", a, 2, l); if (typeof a[0] === "string" && typeof a[1] === "string") return a[0].includes(a[1]); if (Array.isArray(a[0])) { const t = valueToString(a[1]); return a[0].some(v => valueToString(v) === t); } throw new BreezeError("contains() needs text or a list first", l); }),
      makeBuiltin("trim", (a, l) => { checkArgCount("trim", a, 1, l); if (typeof a[0] !== "string") throw new BreezeError("trim() needs text", l); return a[0].trim(); }),
      makeBuiltin("replace", (a, l) => { checkArgCount("replace", a, 3, l); if (typeof a[0] !== "string" || typeof a[1] !== "string" || typeof a[2] !== "string") throw new BreezeError("replace() needs three pieces of text", l); return a[0].split(a[1]).join(a[2]); }),
      makeBuiltin("slice", (a, l) => { if (a.length < 2 || a.length > 3) throw new BreezeError("slice() needs 2 or 3 values", l); if (typeof a[0] !== "string") throw new BreezeError("slice() needs text first", l); let s = Math.floor(toNumber(a[1], l)); let e = a.length === 3 ? Math.floor(toNumber(a[2], l)) : a[0].length; if (s < 0) s = Math.max(0, s + a[0].length); if (e < 0) e += a[0].length; return a[0].slice(s, e); }),
      makeBuiltin("starts_with", (a, l) => { checkArgCount("starts_with", a, 2, l); if (typeof a[0] !== "string" || typeof a[1] !== "string") throw new BreezeError("starts_with() needs two pieces of text", l); return a[0].startsWith(a[1]); }),
      makeBuiltin("ends_with", (a, l) => { checkArgCount("ends_with", a, 2, l); if (typeof a[0] !== "string" || typeof a[1] !== "string") throw new BreezeError("ends_with() needs two pieces of text", l); return a[0].endsWith(a[1]); }),
      makeBuiltin("index_of", (a, l) => { checkArgCount("index_of", a, 2, l); if (typeof a[0] === "string" && typeof a[1] === "string") return a[0].indexOf(a[1]); if (Array.isArray(a[0])) { const t = valueToString(a[1]); return a[0].findIndex(v => valueToString(v) === t); } throw new BreezeError("index_of() needs text or a list first", l); }),
      makeBuiltin("reverse", (a, l) => { checkArgCount("reverse", a, 1, l); if (typeof a[0] === "string") return a[0].split("").reverse().join(""); if (Array.isArray(a[0])) return a[0].slice().reverse(); throw new BreezeError("reverse() needs text or a list", l); }),
      makeBuiltin("repeat_text", (a, l) => { checkArgCount("repeat_text", a, 2, l); if (typeof a[0] !== "string") throw new BreezeError("repeat_text() needs text first", l); const n = Math.floor(toNumber(a[1], l)); if (n < 0) throw new BreezeError("repeat_text() count cannot be negative", l); return a[0].repeat(n); }),
    ]);
    return m;
  }

  // ----- Browser-safe stdlib objects -----
  function makeObject(props) { return { kind: "object", props: new Map(props) }; }

  function createJsonObject() {
    function jsToBreeze(v) {
      if (v === null) return null;
      if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") return v;
      if (Array.isArray(v)) return v.map(jsToBreeze);
      if (typeof v === "object") return Object.entries(v).map(([k, val]) => [k, jsToBreeze(val)]);
      return null;
    }
    function breezeToJs(v) {
      if (v === null) return null;
      if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") return v;
      if (Array.isArray(v)) {
        if (v.length > 0 && v.every(i => Array.isArray(i) && i.length === 2 && typeof i[0] === "string")) {
          const o = {}; for (const i of v) o[i[0]] = breezeToJs(i[1]); return o;
        }
        return v.map(breezeToJs);
      }
      return null;
    }
    return makeObject([
      makeBuiltin("parse", (a, l) => { if (a.length !== 1 || typeof a[0] !== "string") throw new BreezeError("json.parse() needs one text value", l); try { return jsToBreeze(JSON.parse(a[0])); } catch (e) { throw new BreezeError("json.parse() failed: " + e.message, l); } }),
      makeBuiltin("stringify", (a, l) => { if (a.length !== 1) throw new BreezeError("json.stringify() needs one value", l); return JSON.stringify(breezeToJs(a[0])); }),
      makeBuiltin("get", (a, l) => { if (a.length !== 2 || !Array.isArray(a[0])) throw new BreezeError("json.get() needs an object and a key", l); const k = valueToString(a[1]); for (const i of a[0]) if (Array.isArray(i) && i.length === 2 && valueToString(i[0]) === k) return i[1]; return null; }),
      makeBuiltin("has", (a, l) => { if (a.length !== 2 || !Array.isArray(a[0])) throw new BreezeError("json.has() needs an object and a key", l); const k = valueToString(a[1]); return a[0].some(i => Array.isArray(i) && i.length === 2 && valueToString(i[0]) === k); }),
      makeBuiltin("keys", (a, l) => { if (a.length !== 1 || !Array.isArray(a[0])) throw new BreezeError("json.keys() needs an object", l); return a[0].filter(i => Array.isArray(i) && i.length === 2).map(i => i[0]); }),
    ]);
  }

  function createMathObject() {
    const p = [["pi", Math.PI], ["e", Math.E], ["tau", Math.PI * 2]];
    const fns = [
      makeBuiltin("sqrt", (a, l) => { checkArgCount("sqrt", a, 1, l); return Math.sqrt(toNumber(a[0], l)); }),
      makeBuiltin("pow", (a, l) => { checkArgCount("pow", a, 2, l); return Math.pow(toNumber(a[0], l), toNumber(a[1], l)); }),
      makeBuiltin("sin", (a, l) => { checkArgCount("sin", a, 1, l); return Math.sin(toNumber(a[0], l)); }),
      makeBuiltin("cos", (a, l) => { checkArgCount("cos", a, 1, l); return Math.cos(toNumber(a[0], l)); }),
      makeBuiltin("tan", (a, l) => { checkArgCount("tan", a, 1, l); return Math.tan(toNumber(a[0], l)); }),
      makeBuiltin("log", (a, l) => { checkArgCount("log", a, 1, l); return Math.log(toNumber(a[0], l)); }),
      makeBuiltin("exp", (a, l) => { checkArgCount("exp", a, 1, l); return Math.exp(toNumber(a[0], l)); }),
    ];
    return makeObject(p.concat(fns));
  }

  function createTimeObject() {
    return makeObject([
      makeBuiltin("now", () => Date.now()),
      makeBuiltin("seconds", () => Math.floor(Date.now() / 1000)),
    ]);
  }

  function createHtmlObject() {
    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    return makeObject([
      makeBuiltin("escape", (a, l) => { checkArgCount("escape", a, 1, l); return esc(valueToString(a[0])); }),
      makeBuiltin("tag", (a, l) => {
        // html.tag(name, content) or html.tag(name, content, attrs)
        if (a.length < 2 || a.length > 3) throw new BreezeError("html.tag() needs 2 or 3 values", l);
        const name = valueToString(a[0]);
        const content = valueToString(a[1]);
        let attrs = "";
        if (a.length === 3 && Array.isArray(a[2])) {
          for (const pair of a[2]) {
            if (Array.isArray(pair) && pair.length === 2) attrs += " " + esc(pair[0]) + "=\"" + esc(pair[1]) + "\"";
          }
        }
        return "<" + name + attrs + ">" + content + "</" + name + ">";
      }),
      makeBuiltin("page", (a, l) => {
        if (a.length !== 2) throw new BreezeError("html.page() needs a title and body", l);
        return "<!DOCTYPE html><html><head><title>" + esc(valueToString(a[0])) + "</title></head><body>" + valueToString(a[1]) + "</body></html>";
      }),
      makeBuiltin("div", (a, l) => { checkArgCount("div", a, 1, l); return "<div>" + valueToString(a[0]) + "</div>"; }),
      makeBuiltin("p", (a, l) => { checkArgCount("p", a, 1, l); return "<p>" + valueToString(a[0]) + "</p>"; }),
      makeBuiltin("h1", (a, l) => { checkArgCount("h1", a, 1, l); return "<h1>" + valueToString(a[0]) + "</h1>"; }),
      makeBuiltin("h2", (a, l) => { checkArgCount("h2", a, 1, l); return "<h2>" + valueToString(a[0]) + "</h2>"; }),
      makeBuiltin("h3", (a, l) => { checkArgCount("h3", a, 1, l); return "<h3>" + valueToString(a[0]) + "</h3>"; }),
      makeBuiltin("link", (a, l) => { if (a.length !== 2) throw new BreezeError("html.link() needs a URL and text", l); return "<a href=\"" + esc(valueToString(a[0])) + "\">" + esc(valueToString(a[1])) + "</a>"; }),
    ]);
  }

  function createDomObject() {
    // DOM manipulation — lets Breeze build interactive pages.
    return makeObject([
      makeBuiltin("set", (a, l) => {
        if (a.length !== 2) throw new BreezeError("dom.set() needs an id and html", l);
        const el = document.getElementById(valueToString(a[0]));
        if (!el) throw new BreezeError("dom.set() — no element with id '" + a[0] + "'", l);
        el.innerHTML = valueToString(a[1]);
        return null;
      }),
      makeBuiltin("text", (a, l) => {
        if (a.length !== 2) throw new BreezeError("dom.text() needs an id and text", l);
        const el = document.getElementById(valueToString(a[0]));
        if (!el) throw new BreezeError("dom.text() — no element with id '" + a[0] + "'", l);
        el.textContent = valueToString(a[1]);
        return null;
      }),
      makeBuiltin("get", (a, l) => {
        checkArgCount("get", a, 1, l);
        const el = document.getElementById(valueToString(a[0]));
        return el ? el.textContent : null;
      }),
      makeBuiltin("append", (a, l) => {
        if (a.length !== 2) throw new BreezeError("dom.append() needs an id and html", l);
        const el = document.getElementById(valueToString(a[0]));
        if (!el) throw new BreezeError("dom.append() — no element with id '" + a[0] + "'", l);
        el.insertAdjacentHTML("beforeend", valueToString(a[1]));
        return null;
      }),
      makeBuiltin("value", (a, l) => {
        checkArgCount("value", a, 1, l);
        const el = document.getElementById(valueToString(a[0]));
        return el ? el.value : null;
      }),
      makeBuiltin("set_value", (a, l) => {
        if (a.length !== 2) throw new BreezeError("dom.set_value() needs an id and value", l);
        const el = document.getElementById(valueToString(a[0]));
        if (!el) throw new BreezeError("dom.set_value() — no element with id '" + a[0] + "'", l);
        el.value = valueToString(a[1]);
        return null;
      }),
      makeBuiltin("hide", (a, l) => {
        checkArgCount("hide", a, 1, l);
        const el = document.getElementById(valueToString(a[0]));
        if (el) el.style.display = "none";
        return null;
      }),
      makeBuiltin("show", (a, l) => {
        checkArgCount("show", a, 1, l);
        const el = document.getElementById(valueToString(a[0]));
        if (el) el.style.display = "";
        return null;
      }),
      makeBuiltin("on", (a, l) => {
        if (a.length !== 3) throw new BreezeError("dom.on() needs id, event, and handler", l);
        const el = document.getElementById(valueToString(a[0]));
        if (!el) throw new BreezeError("dom.on() — no element with id '" + a[0] + "'", l);
        const event = valueToString(a[1]);
        const handler = a[2];
        el.addEventListener(event, function () {
          try { global.Breeze._callFn(handler, []); }
          catch (e) { console.error("[breeze]", e); }
        });
        return null;
      }),
    ]);
  }

  function createJsObject() {
    // JS interop — call JavaScript from Breeze in the browser.
    return makeObject([
      makeBuiltin("eval", (a, l) => {
        checkArgCount("eval", a, 1, l);
        try { return jsToBreeze(eval(valueToString(a[0]))); }
        catch (e) { throw new BreezeError("js.eval() error: " + e.message, l); }
      }),
      makeBuiltin("get", (a, l) => {
        checkArgCount("get", a, 1, l);
        const name = valueToString(a[0]);
        try { return jsToBreeze(global[name]); }
        catch (e) { return null; }
      }),
      makeBuiltin("call", (a, l) => {
        if (a.length < 1) throw new BreezeError("js.call() needs a function name", l);
        const name = valueToString(a[0]);
        const args = a.slice(1);
        try {
          const fn = global[name];
          if (typeof fn !== "function") throw new BreezeError("js.call() — '" + name + "' is not a function", l);
          return jsToBreeze(fn.apply(null, args.map(breezeToJs)));
        } catch (e) { throw new BreezeError("js.call() error: " + e.message, l); }
      }),
    ]);
  }

  function jsToBreeze(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(jsToBreeze);
    if (typeof v === "object") return Object.entries(v).map(([k, val]) => [k, jsToBreeze(val)]);
    return null;
  }
  function breezeToJs(v) {
    if (v === null) return null;
    if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") return v;
    if (Array.isArray(v)) {
      if (v.length > 0 && v.every(i => Array.isArray(i) && i.length === 2 && typeof i[0] === "string")) {
        const o = {}; for (const i of v) o[i[0]] = breezeToJs(i[1]); return o;
      }
      return v.map(breezeToJs);
    }
    return null;
  }

  // ===========================================================================
  // 8. Interpreter
  // ===========================================================================
  const MAX_STEPS = 100000000;

  class Interpreter {
    constructor(onOutput) {
      this.onOutput = onOutput || null;
      this.steps = 0;
      this.global = new Environment();
      for (const [name, fn] of createBuiltins()) this.global.define(name, fn);
      this.global.define("json", createJsonObject());
      this.global.define("math", createMathObject());
      this.global.define("time", createTimeObject());
      this.global.define("html", createHtmlObject());
      this.global.define("dom", createDomObject());
      this.global.define("js", createJsObject());
    }

    run(program) {
      for (const stmt of program.body) {
        if (stmt.type === "Func") {
          this.global.define(stmt.name, { kind: "function", name: stmt.name, params: stmt.params, body: stmt.body, closure: this.global });
        }
      }
      for (const stmt of program.body) {
        if (stmt.type === "Func") continue;
        this.execute(stmt, this.global);
      }
    }

    tick(line) { this.steps++; if (this.steps > MAX_STEPS) throw new BreezeError("Program ran for too long — possible infinite loop", line); }

    execute(stmt, env) {
      this.tick(stmt.line);
      switch (stmt.type) {
        case "Show": {
          const parts = stmt.args.map(a => valueToString(this.evaluate(a, env)));
          if (this.onOutput) this.onOutput(parts.join(" "));
          return;
        }
        case "ExpressionStatement": this.evaluate(stmt.expression, env); return;
        case "Assignment": { const v = this.evaluate(stmt.value, env); this.assign(stmt.target, v, env, stmt.line); return; }
        case "If": {
          if (isTruthy(this.evaluate(stmt.test, env))) { for (const s of stmt.consequent) this.execute(s, env); return; }
          for (const e of stmt.elifs) { if (isTruthy(this.evaluate(e.test, env))) { for (const s of e.body) this.execute(s, env); return; } }
          for (const s of stmt.alternate) this.execute(s, env);
          return;
        }
        case "While": {
          while (isTruthy(this.evaluate(stmt.test, env))) {
            try { for (const s of stmt.body) this.execute(s, env); }
            catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; }
          }
          return;
        }
        case "Repeat": {
          const c = Math.floor(toNumber(this.evaluate(stmt.count, env), stmt.line));
          if (c < 0) throw new BreezeError("repeat count cannot be negative", stmt.line);
          for (let i = 0; i < c; i++) { try { for (const s of stmt.body) this.execute(s, env); } catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; } }
          return;
        }
        case "RepeatRange": {
          const from = Math.floor(toNumber(this.evaluate(stmt.from, env), stmt.line));
          const to = Math.floor(toNumber(this.evaluate(stmt.to, env), stmt.line));
          for (let i = from; i <= to; i++) { env.define(stmt.variable, i); try { for (const s of stmt.body) this.execute(s, env); } catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; } }
          return;
        }
        case "For": {
          const it = this.evaluate(stmt.iterable, env);
          if (!Array.isArray(it)) throw new BreezeError("for needs a list, not " + typeName(it), stmt.line);
          for (const item of it) { env.define(stmt.variable, item); try { for (const s of stmt.body) this.execute(s, env); } catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; } }
          return;
        }
        case "Func": env.set(stmt.name, { kind: "function", name: stmt.name, params: stmt.params, body: stmt.body, closure: env }); return;
        case "Return": throw new ReturnSignal(stmt.value ? this.evaluate(stmt.value, env) : null);
        case "Break": throw new BreakSignal();
        case "Continue": throw new ContinueSignal();
      }
    }

    assign(target, value, env, line) {
      if (target.type === "Identifier") { env.set(target.name, value); return; }
      if (target.type === "Index") {
        const obj = this.evaluate(target.object, env);
        const idx = this.evaluate(target.index, env);
        if (Array.isArray(obj)) { const i = Math.floor(toNumber(idx, line)); if (i < 0 || i >= obj.length) throw new BreezeError("List index " + i + " is out of range", line); obj[i] = value; return; }
        throw new BreezeError("Cannot set item on " + typeName(obj), line);
      }
      throw new BreezeError("Invalid assignment target", line);
    }

    evaluate(expr, env) {
      this.tick(expr.line);
      switch (expr.type) {
        case "Literal": return expr.value;
        case "Identifier": { const v = env.get(expr.name); if (v === undefined) throw new BreezeError("Name '" + expr.name + "' is not defined", expr.line); return v; }
        case "List": return expr.elements.map(e => this.evaluate(e, env));
        case "Unary": { const v = this.evaluate(expr.operand, env); if (expr.operator === "-") return -toNumber(v, expr.line); if (expr.operator === "not") return !isTruthy(v); throw new BreezeError("Unknown operator " + expr.operator, expr.line); }
        case "Binary": return this.evalBinary(expr, env);
        case "Call": return this.evalCall(expr, env);
        case "Index": return this.evalIndex(expr, env);
        case "Member": {
          const obj = this.evaluate(expr.object, env);
          if (obj && typeof obj === "object" && obj.kind === "object") { if (obj.props.has(expr.property)) return obj.props.get(expr.property); throw new BreezeError("Property '" + expr.property + "' not found", expr.line); }
          throw new BreezeError("Cannot access '." + expr.property + "' on " + typeName(obj), expr.line);
        }
        case "FuncLiteral": return { kind: "function", name: "<anonymous>", params: expr.params, body: expr.body, closure: env };
        case "StringInterpolation": { let r = ""; for (const p of expr.parts) { if (typeof p === "string") r += p; else r += valueToString(this.evaluate(p, env)); } return r; }
      }
    }

    evalBinary(expr, env) {
      if (expr.operator === "and") { const l = this.evaluate(expr.left, env); if (!isTruthy(l)) return false; return isTruthy(this.evaluate(expr.right, env)); }
      if (expr.operator === "or") { const l = this.evaluate(expr.left, env); if (isTruthy(l)) return true; return isTruthy(this.evaluate(expr.right, env)); }
      const l = this.evaluate(expr.left, env);
      const r = this.evaluate(expr.right, env);
      switch (expr.operator) {
        case "+":
          if (typeof l === "number" && typeof r === "number") return l + r;
          if (typeof l === "string" || typeof r === "string") return valueToString(l) + valueToString(r);
          if (Array.isArray(l) && Array.isArray(r)) return l.concat(r);
          throw new BreezeError("Cannot add " + typeName(l) + " and " + typeName(r), expr.line);
        case "-": return toNumber(l, expr.line) - toNumber(r, expr.line);
        case "*": return toNumber(l, expr.line) * toNumber(r, expr.line);
        case "/": { const d = toNumber(r, expr.line); if (d === 0) throw new BreezeError("Cannot divide by zero", expr.line); return toNumber(l, expr.line) / d; }
        case "%": { const d = toNumber(r, expr.line); if (d === 0) throw new BreezeError("Cannot mod by zero", expr.line); return toNumber(l, expr.line) % d; }
        case "==": return deepEqual(l, r);
        case "!=": return !deepEqual(l, r);
        case "<": return compare(l, r, expr.line) < 0;
        case ">": return compare(l, r, expr.line) > 0;
        case "<=": return compare(l, r, expr.line) <= 0;
        case ">=": return compare(l, r, expr.line) >= 0;
      }
      throw new BreezeError("Unknown operator " + expr.operator, expr.line);
    }

    evalCall(expr, env) {
      const callee = this.evaluate(expr.callee, env);
      const args = expr.args.map(a => this.evaluate(a, env));
      if (callee && typeof callee === "object" && callee.kind) {
        if (callee.kind === "builtin") return callee.fn(args, expr.line);
        if (callee.kind === "function") {
          if (args.length !== callee.params.length) throw new BreezeError("Function " + callee.name + "() needs " + callee.params.length + " values but got " + args.length, expr.line);
          const callEnv = new Environment(callee.closure);
          callee.params.forEach((p, i) => callEnv.define(p, args[i]));
          try { for (const s of callee.body) this.execute(s, callEnv); } catch (e) { if (e instanceof ReturnSignal) return e.value; throw e; }
          return null;
        }
      }
      throw new BreezeError("Cannot call " + typeName(callee), expr.line);
    }

    evalIndex(expr, env) {
      const obj = this.evaluate(expr.object, env);
      const idx = this.evaluate(expr.index, env);
      if (Array.isArray(obj)) { let i = Math.floor(toNumber(idx, expr.line)); if (i < 0) i += obj.length; if (i < 0 || i >= obj.length) throw new BreezeError("List index " + Math.floor(toNumber(idx, expr.line)) + " is out of range", expr.line); return obj[i]; }
      if (typeof obj === "string") { let i = Math.floor(toNumber(idx, expr.line)); if (i < 0) i += obj.length; if (i < 0 || i >= obj.length) throw new BreezeError("Text index out of range", expr.line); return obj[i]; }
      throw new BreezeError("Cannot get item from " + typeName(obj), expr.line);
    }
  }

  // ===========================================================================
  // 9. Public API
  // ===========================================================================

  /** Run Breeze source code. Returns { output, error, errorLine, errorFormatted }.
   *  If `outputTarget` is a string (element id) or DOM element, `show` output
   *  is appended to that element instead of (or in addition to) the result. */
  function run(source, outputTarget) {
    const output = [];
    let onOutput = null;
    let targetEl = null;
    if (typeof outputTarget === "string") targetEl = document.getElementById(outputTarget);
    else if (outputTarget && outputTarget.appendChild) targetEl = outputTarget;
    if (targetEl) {
      onOutput = (line) => {
        output.push(line);
        const div = document.createElement("div");
        div.textContent = line;
        targetEl.appendChild(div);
      };
    } else {
      onOutput = (line) => output.push(line);
    }
    try {
      const tokens = tokenize(source);
      const program = new Parser(tokens).parse();
      const interp = new Interpreter(onOutput);
      _activeInterp = interp;
      interp.run(program);
      return { output: output, error: null, errorLine: null, errorFormatted: null };
    } catch (e) {
      if (e instanceof BreezeError) {
        let formatted = e.line > 0
          ? "Error (line " + e.line + "): " + e.message + "\n  " + " ".repeat(String(e.line).length) + " | " + (source.split("\n")[e.line - 1] || "")
          : "Error: " + e.message;
        return { output: output, error: e.message, errorLine: e.line || null, errorFormatted: formatted };
      }
      return { output: output, error: String(e), errorLine: null, errorFormatted: String(e) };
    }
  }

  /** Format an error for display in the DOM. */
  function formatError(err, source) {
    if (err.line <= 0) return "Error: " + err.message;
    const lines = source.split("\n");
    const idx = err.line - 1;
    if (idx < 0 || idx >= lines.length) return "Error (line " + err.line + "): " + err.message;
    const pad = " ".repeat(String(err.line).length);
    return "Error (line " + err.line + "): " + err.message + "\n  " + pad + " | " + lines[idx];
  }

  // ===========================================================================
  // 10. Auto-run <script type="text/breeze"> tags on DOMContentLoaded
  // ===========================================================================

  /** Remove common leading whitespace from all lines, so Breeze code nested
   *  inside an indented <script> tag works correctly. Also strips leading
   *  and trailing blank lines. */
  function dedent(source) {
    let lines = source.replace(/\t/g, "  ").split("\n");
    // Strip leading/trailing blank lines.
    while (lines.length && lines[0].trim() === "") lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    if (!lines.length) return "";
    // Find the minimum indentation across non-blank lines.
    let minIndent = Infinity;
    for (const line of lines) {
      if (line.trim() === "") continue;
      const indent = line.length - line.trimStart().length;
      if (indent < minIndent) minIndent = indent;
    }
    if (minIndent === Infinity || minIndent === 0) return lines.join("\n");
    return lines.map((line) => (line.trim() === "" ? "" : line.slice(minIndent))).join("\n");
  }

  function autoRunScripts() {
    const scripts = document.querySelectorAll('script[type="text/breeze"]');
    scripts.forEach(function (script) {
      const source = dedent(script.textContent || "");
      // Determine where to send output: the next sibling element with
      // class "breeze-output", or an element id given by data-output attr,
      // or console.log as a fallback.
      let targetEl = null;
      if (script.dataset.output) targetEl = document.getElementById(script.dataset.output);
      if (!targetEl) {
        let next = script.nextElementSibling;
        if (next && next.classList && next.classList.contains("breeze-output")) targetEl = next;
      }
      let onOutput;
      const outputLines = [];
      if (targetEl) {
        onOutput = function (line) {
          outputLines.push(line);
          const div = document.createElement("div");
          div.textContent = line;
          targetEl.appendChild(div);
        };
      } else {
        onOutput = function (line) { outputLines.push(line); console.log("[breeze] " + line); };
      }
      try {
        const tokens = tokenize(source);
        const program = new Parser(tokens).parse();
        const interp = new Interpreter(onOutput);
        interp.run(program);
      } catch (e) {
        const msg = e instanceof BreezeError
          ? formatError(e, source)
          : String(e);
        if (targetEl) {
          const pre = document.createElement("pre");
          pre.style.color = "#e11d48";
          pre.textContent = msg;
          targetEl.appendChild(pre);
        } else {
          console.error("[breeze] " + msg);
        }
      }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoRunScripts);
    } else {
      autoRunScripts();
    }
  }

  // ===========================================================================
  // 11. Export
  // ===========================================================================
  const Breeze = {
    run: run,
    tokenize: tokenize,
    Parser: Parser,
    Interpreter: Interpreter,
    BreezeError: BreezeError,
    version: "1.2.0",
    _callFn: function (fn, args) {
      if (fn && fn.kind === "function") {
        const callEnv = new Environment(fn.closure);
        fn.params.forEach((p, i) => callEnv.define(p, args[i] || null));
        try {
          for (const s of fn.body) _activeInterp.execute(s, callEnv);
        } catch (e) { if (!(e instanceof ReturnSignal)) throw e; }
      }
    },
  };

  let _activeInterp = null;

  if (typeof module !== "undefined" && module.exports) module.exports = Breeze;
  global.Breeze = Breeze;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
