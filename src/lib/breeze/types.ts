// Type definitions.

export class BreezeError extends Error {
  line: number;
  constructor(message: string, line: number = 0) {
    super(message);
    this.name = "BreezeError";
    this.line = line;
  }
}

export type TokenType =
  | "NUMBER"
  | "STRING"
  | "IDENT"
  | "KEYWORD"
  | "OP"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "LBRACE"
  | "RBRACE"
  | "COLON"
  | "COMMA"
  | "DOT"
  | "NEWLINE"
  | "INDENT"
  | "DEDENT"
  | "EOF";

export interface Token {
  type: TokenType;
  // STRING with interpolation carries parts[]; plain STRING carries a string.
  value?: string | number | { text: string; expr?: string }[];
  line: number;
}

export interface Program {
  type: "Program";
  body: Statement[];
}

export interface ShowStatement {
  type: "Show";
  args: Expression[];
  line: number;
}

export interface Assignment {
  type: "Assignment";
  target: Expression;
  value: Expression;
  line: number;
}

export interface IfStatement {
  type: "If";
  test: Expression;
  consequent: Statement[];
  alternate: Statement[];
  // Flat elif chain instead of nested else-if.
  elifs: { test: Expression; body: Statement[] }[];
  line: number;
}

export interface WhileStatement {
  type: "While";
  test: Expression;
  body: Statement[];
  line: number;
}

export interface RepeatStatement {
  type: "Repeat";
  count: Expression;
  body: Statement[];
  line: number;
}

export interface RepeatRangeStatement {
  type: "RepeatRange";
  variable: string;
  from: Expression;
  to: Expression;
  body: Statement[];
  line: number;
}

export interface ForStatement {
  type: "For";
  variable: string;
  iterable: Expression;
  body: Statement[];
  line: number;
}

export interface FuncDeclaration {
  type: "Func";
  name: string;
  params: string[];
  body: Statement[];
  line: number;
}

export interface ReturnStatement {
  type: "Return";
  value: Expression | null;
  line: number;
}

export interface BreakStatement {
  type: "Break";
  line: number;
}

export interface ContinueStatement {
  type: "Continue";
  line: number;
}

export interface ExpressionStatement {
  type: "ExpressionStatement";
  expression: Expression;
  line: number;
}

export interface ImportStatement {
  type: "Import";
  names: string[];
  path: string;
  line: number;
}

export interface ExportStatement {
  type: "Export";
  declaration: FuncDeclaration | Assignment;
  line: number;
}

export type Statement =
  | ShowStatement
  | Assignment
  | IfStatement
  | WhileStatement
  | RepeatStatement
  | RepeatRangeStatement
  | ForStatement
  | FuncDeclaration
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | ExpressionStatement
  | ImportStatement
  | ExportStatement;

export interface BinaryExpression {
  type: "Binary";
  operator: string;
  left: Expression;
  right: Expression;
  line: number;
}

export interface UnaryExpression {
  type: "Unary";
  operator: string;
  operand: Expression;
  line: number;
}

export interface CallExpression {
  type: "Call";
  callee: Expression;
  args: Expression[];
  line: number;
}

export interface IndexExpression {
  type: "Index";
  object: Expression;
  index: Expression;
  line: number;
}

export interface MemberExpression {
  type: "Member";
  object: Expression;
  property: string;
  line: number;
}

export interface Literal {
  type: "Literal";
  value: RuntimeValue;
  line: number;
}

export interface Identifier {
  type: "Identifier";
  name: string;
  line: number;
}

export interface ListLiteral {
  type: "List";
  elements: Expression[];
  line: number;
}

export interface FuncLiteral {
  type: "FuncLiteral";
  params: string[];
  body: Statement[];
  line: number;
}

export interface StringInterpolation {
  type: "StringInterpolation";
  parts: (string | Expression)[];
  line: number;
}

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | IndexExpression
  | MemberExpression
  | Literal
  | Identifier
  | ListLiteral
  | FuncLiteral
  | StringInterpolation;

export interface BreezeFunction {
  kind: "function";
  name: string;
  params: string[];
  body: Statement[];
  closure: Environment;
}

export interface BuiltinFunction {
  kind: "builtin";
  name: string;
  fn: (args: RuntimeValue[], line: number) => RuntimeValue;
}

export interface ObjectValue {
  kind: "object";
  props: Map<string, RuntimeValue>;
}

export type RuntimeValue =
  | number
  | string
  | boolean
  | null
  | RuntimeValue[]
  | BreezeFunction
  | BuiltinFunction
  | ObjectValue;

export class Environment {
  vars: Map<string, RuntimeValue> = new Map();
  parent: Environment | null;

  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  get(name: string): RuntimeValue | undefined {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    return undefined;
  }

  set(name: string, value: RuntimeValue): void {
    // Update existing binding up the chain; otherwise create local.
    if (this.vars.has(name)) {
      this.vars.set(name, value);
      return;
    }
    if (this.parent && this.parent.has(name)) {
      this.parent.set(name, value);
      return;
    }
    this.vars.set(name, value);
  }

  // Always binds in this scope, ignoring ancestors (params, loop vars).
  define(name: string, value: RuntimeValue): void {
    this.vars.set(name, value);
  }

  has(name: string): boolean {
    if (this.vars.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }
}
