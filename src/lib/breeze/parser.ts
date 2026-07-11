// Parser.

import {
  BreezeError,
  Token,
  Program,
  Statement,
  Expression,
} from "./types";
import { tokenizeExpression } from "./lexer";

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  // > 0 inside ( ) or [ ]: newlines are insignificant so expressions can span lines.
  private parenDepth: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private skipTriviaIfInBrackets(): void {
    if (this.parenDepth > 0) this.skipTrivia();
  }

  private peek(offset: number = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t;
  }

  private is(type: string, value?: string): boolean {
    const t = this.current();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  private expect(type: string, value?: string): Token {
    if (!this.is(type, value)) {
      const t = this.current();
      const want = value ? `${value}` : type;
      const got =
        t.value !== undefined ? `'${t.value}'` : t.type.toLowerCase();
      throw new BreezeError(
        `Expected ${want} but found ${got}`,
        t.line
      );
    }
    return this.advance();
  }

  private skipNewlines(): void {
    while (this.is("NEWLINE")) this.advance();
  }

  private skipTrivia(): void {
    // Inside brackets INDENT/DEDENT are noise — drop them.
    while (
      this.is("NEWLINE") ||
      this.is("INDENT") ||
      this.is("DEDENT")
    ) {
      this.advance();
    }
  }

  parse(): Program {
    const body: Statement[] = [];
    this.skipNewlines();
    while (!this.is("EOF")) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    return { type: "Program", body };
  }

  private parseStatement(): Statement {
    const t = this.current();

    if (t.type === "KEYWORD") {
      switch (t.value) {
        case "show":
          return this.parseShow();
        case "if":
          return this.parseIf();
        case "while":
          return this.parseWhile();
        case "repeat":
          return this.parseRepeat();
        case "for":
          return this.parseFor();
        case "return":
          return this.parseReturn();
        case "break": {
          const tok = this.advance();
          return { type: "Break", line: tok.line };
        }
        case "continue": {
          const tok = this.advance();
          return { type: "Continue", line: tok.line };
        }
        case "import":
          return this.parseImport();
        case "export":
          return this.parseExport();
        case "func":
          // Only a declaration if a name follows; else fall through to a func literal.
          if (this.peek(1).type === "IDENT") {
            return this.parseFunc();
          }
          break;
      }
    }

    const expr = this.parseExpression();
    if (this.is("OP", "=")) {
      const assignTok = this.advance();
      const value = this.parseExpression();
      return {
        type: "Assignment",
        target: expr,
        value,
        line: assignTok.line,
      };
    }
    return {
      type: "ExpressionStatement",
      expression: expr,
      line: t.line,
    };
  }

  private parseShow(): Statement {
    const tok = this.expect("KEYWORD", "show");
    const args: Expression[] = [this.parseExpression()];
    while (this.is("COMMA")) {
      this.advance();
      args.push(this.parseExpression());
    }
    return { type: "Show", args, line: tok.line };
  }

  private parseIf(): Statement {
    const tok = this.expect("KEYWORD", "if");
    const test = this.parseExpression();
    this.expect("COLON");
    const consequent = this.parseBlockOrInline();
    const elifs: { test: Expression; body: Statement[] }[] = [];
    let alternate: Statement[] = [];

    while (this.is("KEYWORD", "elif")) {
      this.advance();
      const elifTest = this.parseExpression();
      this.expect("COLON");
      const elifBody = this.parseBlockOrInline();
      elifs.push({ test: elifTest, body: elifBody });
    }

    if (this.is("KEYWORD", "else")) {
      this.advance();
      this.expect("COLON");
      alternate = this.parseBlockOrInline();
    }
    return { type: "If", test, consequent, alternate, elifs, line: tok.line };
  }

  private parseWhile(): Statement {
    const tok = this.expect("KEYWORD", "while");
    const test = this.parseExpression();
    this.expect("COLON");
    const body = this.parseBlockOrInline();
    return { type: "While", test, body, line: tok.line };
  }

  private parseRepeat(): Statement {
    const tok = this.expect("KEYWORD", "repeat");

    if (
      this.peek().type === "IDENT" &&
      this.peek(1).type === "KEYWORD" &&
      this.peek(1).value === "from"
    ) {
      const varTok = this.expect("IDENT");
      this.expect("KEYWORD", "from");
      const from = this.parseExpression();
      this.expect("KEYWORD", "to");
      const to = this.parseExpression();
      this.expect("COLON");
      const body = this.parseBlockOrInline();
      return {
        type: "RepeatRange",
        variable: varTok.value as string,
        from,
        to,
        body,
        line: tok.line,
      };
    }

    const count = this.parseExpression();
    this.expect("COLON");
    const body = this.parseBlockOrInline();
    return { type: "Repeat", count, body, line: tok.line };
  }

  private parseFor(): Statement {
    const tok = this.expect("KEYWORD", "for");
    const varTok = this.expect("IDENT");
    this.expect("KEYWORD", "in");
    const iterable = this.parseExpression();
    this.expect("COLON");
    const body = this.parseBlockOrInline();
    return {
      type: "For",
      variable: varTok.value as string,
      iterable,
      body,
      line: tok.line,
    };
  }

  private parseFunc(): Statement {
    const tok = this.expect("KEYWORD", "func");
    const nameTok = this.expect("IDENT");
    this.expect("LPAREN");
    const params: string[] = [];
    if (!this.is("RPAREN")) {
      params.push((this.expect("IDENT").value as string));
      while (this.is("COMMA")) {
        this.advance();
        params.push((this.expect("IDENT").value as string));
      }
    }
    this.expect("RPAREN");
    this.expect("COLON");
    const body = this.parseBlockOrInline();
    return {
      type: "Func",
      name: nameTok.value as string,
      params,
      body,
      line: tok.line,
    };
  }

  private parseReturn(): Statement {
    const tok = this.expect("KEYWORD", "return");
    if (this.is("NEWLINE") || this.is("DEDENT") || this.is("EOF")) {
      return { type: "Return", value: null, line: tok.line };
    }
    const value = this.parseExpression();
    return { type: "Return", value, line: tok.line };
  }

  // import { name1, name2 } from "path/to/file.bz"
  private parseImport(): Statement {
    const tok = this.expect("KEYWORD", "import");
    this.expect("LBRACE");
    const names: string[] = [];
    if (!this.is("RBRACE")) {
      names.push(this.expect("IDENT").value as string);
      while (this.is("COMMA")) {
        this.advance();
        names.push(this.expect("IDENT").value as string);
      }
    }
    this.expect("RBRACE");
    this.expect("KEYWORD", "from");
    const pathTok = this.expect("STRING");
    return {
      type: "Import",
      names,
      path: pathTok.value as string,
      line: tok.line,
    };
  }

  // export func name(...): ...   or   export name = value
  private parseExport(): Statement {
    const tok = this.expect("KEYWORD", "export");
    if (this.is("KEYWORD", "func")) {
      const decl = this.parseFunc() as Extract<
        Statement,
        { type: "Func" }
      >;
      return { type: "Export", declaration: decl, line: tok.line };
    }
    const nameTok = this.expect("IDENT");
    this.expect("OP", "=");
    const value = this.parseExpression();
    const assignment: Extract<Statement, { type: "Assignment" }> = {
      type: "Assignment",
      target: { type: "Identifier", name: nameTok.value as string, line: tok.line },
      value,
      line: tok.line,
    };
    return { type: "Export", declaration: assignment, line: tok.line };
  }

  private parseBlockOrInline(): Statement[] {
    if (!this.is("NEWLINE")) {
      return [this.parseStatement()];
    }

    this.expect("NEWLINE");
    this.skipNewlines();
    this.expect("INDENT");

    const statements: Statement[] = [];
    this.skipNewlines();
    while (!this.is("DEDENT") && !this.is("EOF")) {
      statements.push(this.parseStatement());
      this.skipNewlines();
    }
    if (!this.is("EOF")) this.expect("DEDENT");
    return statements;
  }

  private parseExpression(): Expression {
    return this.parseOr();
  }

  private parseOr(): Expression {
    let left = this.parseAnd();
    this.skipTriviaIfInBrackets();
    while (this.is("KEYWORD", "or")) {
      const tok = this.advance();
      this.skipTriviaIfInBrackets();
      const right = this.parseAnd();
      left = { type: "Binary", operator: "or", left, right, line: tok.line };
      this.skipTriviaIfInBrackets();
    }
    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseNot();
    this.skipTriviaIfInBrackets();
    while (this.is("KEYWORD", "and")) {
      const tok = this.advance();
      this.skipTriviaIfInBrackets();
      const right = this.parseNot();
      left = { type: "Binary", operator: "and", left, right, line: tok.line };
      this.skipTriviaIfInBrackets();
    }
    return left;
  }

  private parseNot(): Expression {
    if (this.is("KEYWORD", "not")) {
      const tok = this.advance();
      const operand = this.parseNot();
      return { type: "Unary", operator: "not", operand, line: tok.line };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expression {
    let left = this.parseAddition();
    this.skipTriviaIfInBrackets();
    while (
      this.is("OP", "==") ||
      this.is("OP", "!=") ||
      this.is("OP", "<") ||
      this.is("OP", ">") ||
      this.is("OP", "<=") ||
      this.is("OP", ">=")
    ) {
      const tok = this.advance();
      this.skipTriviaIfInBrackets();
      const right = this.parseAddition();
      left = {
        type: "Binary",
        operator: tok.value as string,
        left,
        right,
        line: tok.line,
      };
      this.skipTriviaIfInBrackets();
    }
    return left;
  }

  private parseAddition(): Expression {
    let left = this.parseMultiplication();
    this.skipTriviaIfInBrackets();
    while (this.is("OP", "+") || this.is("OP", "-")) {
      const tok = this.advance();
      this.skipTriviaIfInBrackets();
      const right = this.parseMultiplication();
      left = {
        type: "Binary",
        operator: tok.value as string,
        left,
        right,
        line: tok.line,
      };
      this.skipTriviaIfInBrackets();
    }
    return left;
  }

  private parseMultiplication(): Expression {
    let left = this.parseUnary();
    this.skipTriviaIfInBrackets();
    while (
      this.is("OP", "*") ||
      this.is("OP", "/") ||
      this.is("OP", "%")
    ) {
      const tok = this.advance();
      this.skipTriviaIfInBrackets();
      const right = this.parseUnary();
      left = {
        type: "Binary",
        operator: tok.value as string,
        left,
        right,
        line: tok.line,
      };
      this.skipTriviaIfInBrackets();
    }
    return left;
  }

  private parseUnary(): Expression {
    if (this.is("OP", "-")) {
      const tok = this.advance();
      const operand = this.parseUnary();
      return { type: "Unary", operator: "-", operand, line: tok.line };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();
    while (true) {
      if (this.is("LPAREN")) {
        const tok = this.advance();
        this.parenDepth++;
        const args: Expression[] = [];
        this.skipTrivia();
        if (!this.is("RPAREN")) {
          args.push(this.parseExpression());
          this.skipTrivia();
          while (this.is("COMMA")) {
            this.advance();
            this.skipTrivia();
            if (this.is("RPAREN")) break; // allow trailing comma
            args.push(this.parseExpression());
            this.skipTrivia();
          }
        }
        this.expect("RPAREN");
        this.parenDepth--;
        expr = { type: "Call", callee: expr, args, line: tok.line };
      } else if (this.is("LBRACKET")) {
        const tok = this.advance();
        this.parenDepth++;
        this.skipTrivia();
        const index = this.parseExpression();
        this.skipTrivia();
        this.expect("RBRACKET");
        this.parenDepth--;
        expr = { type: "Index", object: expr, index, line: tok.line };
      } else if (this.is("DOT")) {
        const tok = this.advance();
        const propTok = this.expect("IDENT");
        expr = {
          type: "Member",
          object: expr,
          property: propTok.value as string,
          line: tok.line,
        };
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): Expression {
    const t = this.current();

    if (t.type === "NUMBER") {
      this.advance();
      return { type: "Literal", value: t.value as number, line: t.line };
    }
    if (t.type === "STRING") {
      this.advance();
      if (typeof t.value === "string") {
        return { type: "Literal", value: t.value, line: t.line };
      }
      const parts = t.value as { text: string; expr?: string }[];
      const exprParts: (string | Expression)[] = [];
      for (const p of parts) {
        exprParts.push(p.text);
        if (p.expr !== undefined) {
          const subTokens = tokenizeExpression(p.expr, t.line);
          const subParser = new Parser(subTokens);
          const expr = subParser.parseExpression();
          exprParts.push(expr);
        }
      }
      return { type: "StringInterpolation", parts: exprParts, line: t.line };
    }
    if (t.type === "KEYWORD") {
      if (t.value === "true") {
        this.advance();
        return { type: "Literal", value: true, line: t.line };
      }
      if (t.value === "false") {
        this.advance();
        return { type: "Literal", value: false, line: t.line };
      }
      if (t.value === "none") {
        this.advance();
        return { type: "Literal", value: null, line: t.line };
      }
      if (t.value === "func") {
        const tok = this.advance();
        this.expect("LPAREN");
        const params: string[] = [];
        if (!this.is("RPAREN")) {
          params.push(this.expect("IDENT").value as string);
          while (this.is("COMMA")) {
            this.advance();
            params.push(this.expect("IDENT").value as string);
          }
        }
        this.expect("RPAREN");
        this.expect("COLON");
        const body = this.parseBlockOrInline();
        return { type: "FuncLiteral", params, body, line: tok.line };
      }
      throw new BreezeError(
        `Unexpected keyword '${t.value}' in expression`,
        t.line
      );
    }
    if (t.type === "IDENT") {
      this.advance();
      return { type: "Identifier", name: t.value as string, line: t.line };
    }
    if (t.type === "LPAREN") {
      this.advance();
      this.skipTrivia();
      const expr = this.parseExpression();
      this.skipTrivia();
      this.expect("RPAREN");
      return expr;
    }
    if (t.type === "LBRACKET") {
      this.advance();
      const elements: Expression[] = [];
      this.skipTrivia();
      if (!this.is("RBRACKET")) {
        elements.push(this.parseExpression());
        this.skipTrivia();
        while (this.is("COMMA")) {
          this.advance();
          this.skipTrivia();
          if (this.is("RBRACKET")) break; // allow trailing comma
          elements.push(this.parseExpression());
          this.skipTrivia();
        }
      }
      this.expect("RBRACKET");
      return { type: "List", elements, line: t.line };
    }

    const got = t.value !== undefined ? `'${t.value}'` : t.type.toLowerCase();
    throw new BreezeError(`Unexpected ${got} in expression`, t.line);
  }
}
