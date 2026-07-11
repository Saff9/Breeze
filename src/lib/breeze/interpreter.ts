// Breeze Language — Browser-safe interpreter for the web playground.
//
// This is a trimmed version of the Node interpreter that omits the Node-only
// standard library modules (http, fs, env — which need Node's `fs`, `child_process`,
// and `process` APIs). The browser-safe stdlib (json, time, math) is included
// inline so the playground can still demonstrate the full language.

import {
  BreezeError,
  Program,
  Statement,
  Expression,
  Environment,
  RuntimeValue,
  BreezeFunction,
  BuiltinFunction,
  ObjectValue,
  ImportStatement,
  ExportStatement,
} from "./types";
import { tokenize, tokenizeExpression } from "./lexer";
import { Parser } from "./parser";

// Signal used to unwind the call stack when `return` is executed.
class ReturnSignal {
  value: RuntimeValue;
  constructor(value: RuntimeValue) {
    this.value = value;
  }
}

// Signals used to exit loop iterations early.
class BreakSignal {}
class ContinueSignal {}

const MAX_STEPS = 100_000_000;

// ----- Value helpers (inlined to avoid the Node-only value.ts) -----
function valueToString(v: RuntimeValue): string {
  if (v === null) return "none";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toString();
    return v.toString();
  }
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return "[" + v.map(valueToString).join(", ") + "]";
  }
  if (typeof v === "object" && v !== null && "kind" in v) {
    const fn = v as BreezeFunction | BuiltinFunction;
    return `<function ${fn.name}>`;
  }
  return String(v);
}

function typeName(v: RuntimeValue): string {
  if (v === null) return "none";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  if (Array.isArray(v)) return "list";
  if (typeof v === "object" && v !== null && "kind" in v) return "function";
  return "unknown";
}

function isTruthy(v: RuntimeValue): boolean {
  if (v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function toNumber(v: RuntimeValue, line: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (isNaN(n)) {
      throw new BreezeError(`Cannot convert text "${v}" to a number`, line);
    }
    return n;
  }
  throw new BreezeError(`Cannot convert ${typeName(v)} to a number`, line);
}

// ----- Built-in functions -----
function makeBuiltin(
  name: string,
  fn: (args: RuntimeValue[], line: number) => RuntimeValue
): [string, BuiltinFunction] {
  return [name, { kind: "builtin", name, fn }];
}

function checkArgCount(
  name: string,
  args: RuntimeValue[],
  n: number,
  line: number
): void {
  if (args.length !== n) {
    throw new BreezeError(
      `${name}() needs ${n} value${n === 1 ? "" : "s"} but got ${args.length}`,
      line
    );
  }
}

function createBuiltins(): Map<string, BuiltinFunction> {
  const builtins: Map<string, BuiltinFunction> = new Map([
    makeBuiltin("text", (args, line) => {
      checkArgCount("text", args, 1, line);
      return valueToString(args[0]);
    }),
    makeBuiltin("number", (args, line) => {
      checkArgCount("number", args, 1, line);
      return toNumber(args[0], line);
    }),
    makeBuiltin("len", (args, line) => {
      checkArgCount("len", args, 1, line);
      const v = args[0];
      if (typeof v === "string") return v.length;
      if (Array.isArray(v)) return v.length;
      throw new BreezeError(`len() works on text or lists, not ${typeName(v)}`, line);
    }),
    makeBuiltin("upper", (args, line) => {
      checkArgCount("upper", args, 1, line);
      if (typeof args[0] !== "string") throw new BreezeError("upper() needs text", line);
      return (args[0] as string).toUpperCase();
    }),
    makeBuiltin("lower", (args, line) => {
      checkArgCount("lower", args, 1, line);
      if (typeof args[0] !== "string") throw new BreezeError("lower() needs text", line);
      return (args[0] as string).toLowerCase();
    }),
    makeBuiltin("abs", (args, line) => {
      checkArgCount("abs", args, 1, line);
      return Math.abs(toNumber(args[0], line));
    }),
    makeBuiltin("round", (args, line) => {
      checkArgCount("round", args, 1, line);
      return Math.round(toNumber(args[0], line));
    }),
    makeBuiltin("floor", (args, line) => {
      checkArgCount("floor", args, 1, line);
      return Math.floor(toNumber(args[0], line));
    }),
    makeBuiltin("ceil", (args, line) => {
      checkArgCount("ceil", args, 1, line);
      return Math.ceil(toNumber(args[0], line));
    }),
    makeBuiltin("random", (args, line) => {
      checkArgCount("random", args, 2, line);
      const lo = Math.floor(toNumber(args[0], line));
      const hi = Math.floor(toNumber(args[1], line));
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    }),
    makeBuiltin("sum", (args, line) => {
      checkArgCount("sum", args, 1, line);
      if (!Array.isArray(args[0])) throw new BreezeError("sum() needs a list", line);
      let total = 0;
      for (const item of args[0] as RuntimeValue[]) total += toNumber(item, line);
      return total;
    }),
    makeBuiltin("min", (args, line) => {
      if (args.length === 0) throw new BreezeError("min() needs at least one value", line);
      let result = toNumber(args[0], line);
      for (let i = 1; i < args.length; i++) {
        const n = toNumber(args[i], line);
        if (n < result) result = n;
      }
      return result;
    }),
    makeBuiltin("max", (args, line) => {
      if (args.length === 0) throw new BreezeError("max() needs at least one value", line);
      let result = toNumber(args[0], line);
      for (let i = 1; i < args.length; i++) {
        const n = toNumber(args[i], line);
        if (n > result) result = n;
      }
      return result;
    }),
    makeBuiltin("push", (args, line) => {
      checkArgCount("push", args, 2, line);
      if (!Array.isArray(args[0])) throw new BreezeError("push() needs a list first", line);
      const list = [...(args[0] as RuntimeValue[])];
      list.push(args[1]);
      return list;
    }),
    makeBuiltin("range", (args, line) => {
      if (args.length === 0 || args.length > 2) {
        throw new BreezeError("range() needs 1 or 2 numbers", line);
      }
      let start = 0;
      let end = 0;
      if (args.length === 1) {
        end = toNumber(args[0], line);
      } else {
        start = toNumber(args[0], line);
        end = toNumber(args[1], line);
      }
      const result: RuntimeValue[] = [];
      for (let i = start; i < end; i++) result.push(i);
      return result;
    }),
    makeBuiltin("type", (args, line) => {
      checkArgCount("type", args, 1, line);
      return typeName(args[0]);
    }),
    makeBuiltin("join", (args, line) => {
      checkArgCount("join", args, 2, line);
      if (!Array.isArray(args[0])) throw new BreezeError("join() needs a list first", line);
      if (typeof args[1] !== "string") throw new BreezeError("join() needs text as the separator", line);
      return (args[0] as RuntimeValue[]).map(valueToString).join(args[1] as string);
    }),
    // ----- Text methods -----
    makeBuiltin("split", (args, line) => {
      checkArgCount("split", args, 2, line);
      if (typeof args[0] !== "string") throw new BreezeError("split() needs text first", line);
      if (typeof args[1] !== "string") throw new BreezeError("split() needs text as the separator", line);
      return (args[0] as string).split(args[1] as string);
    }),
    makeBuiltin("contains", (args, line) => {
      checkArgCount("contains", args, 2, line);
      if (typeof args[0] === "string" && typeof args[1] === "string") {
        return (args[0] as string).includes(args[1] as string);
      }
      if (Array.isArray(args[0])) {
        const target = valueToString(args[1]);
        return (args[0] as RuntimeValue[]).some((v) => valueToString(v) === target);
      }
      throw new BreezeError("contains() needs text or a list first", line);
    }),
    makeBuiltin("trim", (args, line) => {
      checkArgCount("trim", args, 1, line);
      if (typeof args[0] !== "string") throw new BreezeError("trim() needs text", line);
      return (args[0] as string).trim();
    }),
    makeBuiltin("replace", (args, line) => {
      checkArgCount("replace", args, 3, line);
      if (typeof args[0] !== "string" || typeof args[1] !== "string" || typeof args[2] !== "string") {
        throw new BreezeError("replace() needs three pieces of text", line);
      }
      return (args[0] as string).split(args[1] as string).join(args[2] as string);
    }),
    makeBuiltin("slice", (args, line) => {
      if (args.length < 2 || args.length > 3) throw new BreezeError("slice() needs 2 or 3 values", line);
      if (typeof args[0] !== "string") throw new BreezeError("slice() needs text first", line);
      const s = args[0] as string;
      let start = Math.floor(toNumber(args[1], line));
      let end = args.length === 3 ? Math.floor(toNumber(args[2], line)) : s.length;
      if (start < 0) start = Math.max(0, start + s.length);
      if (end < 0) end += s.length;
      return s.slice(start, end);
    }),
    makeBuiltin("starts_with", (args, line) => {
      checkArgCount("starts_with", args, 2, line);
      if (typeof args[0] !== "string" || typeof args[1] !== "string") {
        throw new BreezeError("starts_with() needs two pieces of text", line);
      }
      return (args[0] as string).startsWith(args[1] as string);
    }),
    makeBuiltin("ends_with", (args, line) => {
      checkArgCount("ends_with", args, 2, line);
      if (typeof args[0] !== "string" || typeof args[1] !== "string") {
        throw new BreezeError("ends_with() needs two pieces of text", line);
      }
      return (args[0] as string).endsWith(args[1] as string);
    }),
    makeBuiltin("index_of", (args, line) => {
      checkArgCount("index_of", args, 2, line);
      if (typeof args[0] === "string" && typeof args[1] === "string") {
        return (args[0] as string).indexOf(args[1] as string);
      }
      if (Array.isArray(args[0])) {
        const target = valueToString(args[1]);
        return (args[0] as RuntimeValue[]).findIndex((v) => valueToString(v) === target);
      }
      throw new BreezeError("index_of() needs text or a list first", line);
    }),
    makeBuiltin("reverse", (args, line) => {
      checkArgCount("reverse", args, 1, line);
      if (typeof args[0] === "string") {
        return (args[0] as string).split("").reverse().join("");
      }
      if (Array.isArray(args[0])) {
        return [...(args[0] as RuntimeValue[])].reverse();
      }
      throw new BreezeError("reverse() needs text or a list", line);
    }),
    makeBuiltin("repeat_text", (args, line) => {
      checkArgCount("repeat_text", args, 2, line);
      if (typeof args[0] !== "string") throw new BreezeError("repeat_text() needs text first", line);
      const n = Math.floor(toNumber(args[1], line));
      if (n < 0) throw new BreezeError("repeat_text() count cannot be negative", line);
      return (args[0] as string).repeat(n);
    }),
  ]);
  return builtins;
}

// ----- Browser-safe stdlib objects (json, time, math only) -----
function createJsonObject(): ObjectValue {
  const props = new Map<string, RuntimeValue>();
  const make = (name: string, fn: (args: RuntimeValue[], line: number) => RuntimeValue) =>
    props.set(name, { kind: "builtin", name, fn });

  make("parse", (args, line) => {
    if (args.length !== 1 || typeof args[0] !== "string") {
      throw new BreezeError("json.parse() needs one text value", line);
    }
    try {
      return jsToBreeze(JSON.parse(args[0] as string));
    } catch (e) {
      throw new BreezeError(`json.parse() failed: ${e instanceof Error ? e.message : String(e)}`, line);
    }
  });
  make("stringify", (args, line) => {
    if (args.length !== 1) throw new BreezeError("json.stringify() needs one value", line);
    return JSON.stringify(breezeToJs(args[0]));
  });
  make("get", (args, line) => {
    if (args.length !== 2) throw new BreezeError("json.get() needs an object and a key", line);
    if (!Array.isArray(args[0])) throw new BreezeError("json.get() needs an object first", line);
    const key = valueToString(args[1]);
    for (const item of args[0] as RuntimeValue[]) {
      if (Array.isArray(item) && item.length === 2 && valueToString(item[0]) === key) {
        return item[1];
      }
    }
    return null;
  });
  make("has", (args, line) => {
    if (args.length !== 2) throw new BreezeError("json.has() needs an object and a key", line);
    if (!Array.isArray(args[0])) throw new BreezeError("json.has() needs an object first", line);
    const key = valueToString(args[1]);
    for (const item of args[0] as RuntimeValue[]) {
      if (Array.isArray(item) && item.length === 2 && valueToString(item[0]) === key) return true;
    }
    return false;
  });
  make("keys", (args, line) => {
    if (args.length !== 1 || !Array.isArray(args[0])) {
      throw new BreezeError("json.keys() needs an object", line);
    }
    return (args[0] as RuntimeValue[])
      .filter((item) => Array.isArray(item) && item.length === 2)
      .map((item) => (item as RuntimeValue[])[0]);
  });

  function jsToBreeze(v: unknown): RuntimeValue {
    if (v === null) return null;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(jsToBreeze);
    if (typeof v === "object") {
      return Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, jsToBreeze(val)] as [string, RuntimeValue]);
    }
    return null;
  }
  function breezeToJs(v: RuntimeValue): unknown {
    if (v === null) return null;
    if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") return v;
    if (Array.isArray(v)) {
      // If it looks like a list of pairs, convert to an object.
      if (v.length > 0 && v.every((item) => Array.isArray(item) && item.length === 2 && typeof item[0] === "string")) {
        const obj: Record<string, unknown> = {};
        for (const item of (v as RuntimeValue[]) as unknown[][]) {
          obj[item[0] as string] = breezeToJs(item[1] as RuntimeValue);
        }
        return obj;
      }
      return v.map(breezeToJs);
    }
    return null;
  }
  return { kind: "object", props };
}

function createMathObject(): ObjectValue {
  const props = new Map<string, RuntimeValue>();
  props.set("pi", Math.PI);
  props.set("e", Math.E);
  props.set("tau", Math.PI * 2);
  const make = (name: string, fn: (args: RuntimeValue[], line: number) => RuntimeValue) =>
    props.set(name, { kind: "builtin", name, fn });
  make("sqrt", (args, line) => { checkArgCount("sqrt", args, 1, line); return Math.sqrt(toNumber(args[0], line)); });
  make("pow", (args, line) => { checkArgCount("pow", args, 2, line); return Math.pow(toNumber(args[0], line), toNumber(args[1], line)); });
  make("sin", (args, line) => { checkArgCount("sin", args, 1, line); return Math.sin(toNumber(args[0], line)); });
  make("cos", (args, line) => { checkArgCount("cos", args, 1, line); return Math.cos(toNumber(args[0], line)); });
  make("tan", (args, line) => { checkArgCount("tan", args, 1, line); return Math.tan(toNumber(args[0], line)); });
  make("log", (args, line) => { checkArgCount("log", args, 1, line); return Math.log(toNumber(args[0], line)); });
  make("exp", (args, line) => { checkArgCount("exp", args, 1, line); return Math.exp(toNumber(args[0], line)); });
  return { kind: "object", props };
}

function createTimeObject(): ObjectValue {
  const props = new Map<string, RuntimeValue>();
  const make = (name: string, fn: (args: RuntimeValue[], line: number) => RuntimeValue) =>
    props.set(name, { kind: "builtin", name, fn });
  make("now", () => Date.now());
  make("seconds", () => Math.floor(Date.now() / 1000));
  return { kind: "object", props };
}

// ----- Interpreter -----
export class Interpreter {
  private global: Environment;
  private output: string[] = [];
  private steps: number = 0;

  constructor(_options: { sandbox?: boolean } = {}) {
    this.global = new Environment();
    const builtins = createBuiltins();
    for (const [name, fn] of builtins) {
      this.global.define(name, fn);
    }
    // Browser-safe stdlib namespaces.
    this.global.define("json", createJsonObject());
    this.global.define("math", createMathObject());
    this.global.define("time", createTimeObject());
  }

  run(program: Program): string[] {
    // First pass: register functions so call order does not matter.
    for (const stmt of program.body) {
      if (stmt.type === "Func") {
        this.global.define(stmt.name, {
          kind: "function",
          name: stmt.name,
          params: stmt.params,
          body: stmt.body,
          closure: this.global,
        });
      }
    }
    for (const stmt of program.body) {
      if (stmt.type === "Func") continue;
      this.execute(stmt, this.global);
    }
    return this.output;
  }

  private tick(line: number): void {
    this.steps++;
    if (this.steps > MAX_STEPS) {
      throw new BreezeError(
        "Program ran for too long — possible infinite loop",
        line
      );
    }
  }

  private execute(stmt: Statement, env: Environment): void {
    this.tick(stmt.line);
    switch (stmt.type) {
      case "Show": {
        const parts = stmt.args.map((a) => valueToString(this.evaluate(a, env)));
        this.output.push(parts.join(" "));
        return;
      }
      case "ExpressionStatement": {
        this.evaluate(stmt.expression, env);
        return;
      }
      case "Assignment": {
        const value = this.evaluate(stmt.value, env);
        this.assign(stmt.target, value, env, stmt.line);
        return;
      }
      case "If": {
        const test = this.evaluate(stmt.test, env);
        if (isTruthy(test)) {
          for (const s of stmt.consequent) this.execute(s, env);
          return;
        }
        for (const elif of stmt.elifs) {
          if (isTruthy(this.evaluate(elif.test, env))) {
            for (const s of elif.body) this.execute(s, env);
            return;
          }
        }
        for (const s of stmt.alternate) this.execute(s, env);
        return;
      }
      case "While": {
        while (isTruthy(this.evaluate(stmt.test, env))) {
          try {
            for (const s of stmt.body) this.execute(s, env);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return;
      }
      case "Repeat": {
        const count = Math.floor(toNumber(this.evaluate(stmt.count, env), stmt.line));
        if (count < 0) throw new BreezeError("repeat count cannot be negative", stmt.line);
        for (let i = 0; i < count; i++) {
          try {
            for (const s of stmt.body) this.execute(s, env);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return;
      }
      case "RepeatRange": {
        const from = Math.floor(toNumber(this.evaluate(stmt.from, env), stmt.line));
        const to = Math.floor(toNumber(this.evaluate(stmt.to, env), stmt.line));
        for (let i = from; i <= to; i++) {
          env.define(stmt.variable, i);
          try {
            for (const s of stmt.body) this.execute(s, env);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return;
      }
      case "For": {
        const iterable = this.evaluate(stmt.iterable, env);
        if (!Array.isArray(iterable)) {
          throw new BreezeError(`for needs a list, not ${typeName(iterable)}`, stmt.line);
        }
        for (const item of iterable) {
          env.define(stmt.variable, item);
          try {
            for (const s of stmt.body) this.execute(s, env);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return;
      }
      case "Func": {
        env.set(stmt.name, {
          kind: "function",
          name: stmt.name,
          params: stmt.params,
          body: stmt.body,
          closure: env,
        });
        return;
      }
      case "Return": {
        const value = stmt.value ? this.evaluate(stmt.value, env) : null;
        throw new ReturnSignal(value);
      }
      case "Break": throw new BreakSignal();
      case "Continue": throw new ContinueSignal();
      case "Import": {
        throw new BreezeError(
          "imports are not supported in the web playground (save your code to a .bz file to use modules)",
          stmt.line
        );
      }
      case "Export": {
        // Execute the inner declaration so it still runs, just not exported.
        if (stmt.declaration.type === "Func") {
          env.set(stmt.declaration.name, {
            kind: "function",
            name: stmt.declaration.name,
            params: stmt.declaration.params,
            body: stmt.declaration.body,
            closure: env,
          });
        } else {
          const value = this.evaluate(stmt.declaration.value, env);
          this.assign(stmt.declaration.target, value, env, stmt.line);
        }
        return;
      }
    }
  }

  private assign(
    target: Expression,
    value: RuntimeValue,
    env: Environment,
    line: number
  ): void {
    if (target.type === "Identifier") {
      env.set(target.name, value);
      return;
    }
    if (target.type === "Index") {
      const obj = this.evaluate(target.object, env);
      const idx = this.evaluate(target.index, env);
      if (Array.isArray(obj)) {
        const i = Math.floor(toNumber(idx, line));
        if (i < 0 || i >= obj.length) {
          throw new BreezeError(`List index ${i} is out of range (length ${obj.length})`, line);
        }
        obj[i] = value;
        return;
      }
      throw new BreezeError(`Cannot set item on ${typeName(obj)}`, line);
    }
    throw new BreezeError("Invalid assignment target", line);
  }

  private evaluate(expr: Expression, env: Environment): RuntimeValue {
    this.tick(expr.line);
    switch (expr.type) {
      case "Literal": return expr.value;
      case "Identifier": {
        const v = env.get(expr.name);
        if (v === undefined) {
          throw new BreezeError(`Name '${expr.name}' is not defined`, expr.line);
        }
        return v;
      }
      case "List": return expr.elements.map((e) => this.evaluate(e, env));
      case "Unary": {
        const v = this.evaluate(expr.operand, env);
        if (expr.operator === "-") return -toNumber(v, expr.line);
        if (expr.operator === "not") return !isTruthy(v);
        throw new BreezeError(`Unknown operator ${expr.operator}`, expr.line);
      }
      case "Binary": return this.evalBinary(expr, env);
      case "Call": return this.evalCall(expr, env);
      case "Index": return this.evalIndex(expr, env);
      case "Member": {
        const obj = this.evaluate(expr.object, env);
        if (obj !== null && typeof obj === "object" && "kind" in obj && (obj as ObjectValue).kind === "object") {
          const props = (obj as ObjectValue).props;
          if (props.has(expr.property)) return props.get(expr.property)!;
          throw new BreezeError(`Property '${expr.property}' not found`, expr.line);
        }
        throw new BreezeError(`Cannot access '.${expr.property}' on ${typeName(obj)}`, expr.line);
      }
      case "FuncLiteral": {
        return {
          kind: "function",
          name: "<anonymous>",
          params: expr.params,
          body: expr.body,
          closure: env,
        };
      }
      case "StringInterpolation": {
        let result = "";
        for (const part of expr.parts) {
          if (typeof part === "string") {
            result += part;
          } else {
            result += valueToString(this.evaluate(part, env));
          }
        }
        return result;
      }
    }
  }

  private evalBinary(
    expr: Extract<Expression, { type: "Binary" }>,
    env: Environment
  ): RuntimeValue {
    if (expr.operator === "and") {
      const left = this.evaluate(expr.left, env);
      if (!isTruthy(left)) return false;
      return isTruthy(this.evaluate(expr.right, env));
    }
    if (expr.operator === "or") {
      const left = this.evaluate(expr.left, env);
      if (isTruthy(left)) return true;
      return isTruthy(this.evaluate(expr.right, env));
    }
    const left = this.evaluate(expr.left, env);
    const right = this.evaluate(expr.right, env);
    switch (expr.operator) {
      case "+": {
        if (typeof left === "number" && typeof right === "number") return left + right;
        if (typeof left === "string" || typeof right === "string") {
          return valueToString(left) + valueToString(right);
        }
        if (Array.isArray(left) && Array.isArray(right)) return [...left, ...right];
        throw new BreezeError(`Cannot add ${typeName(left)} and ${typeName(right)}`, expr.line);
      }
      case "-": return toNumber(left, expr.line) - toNumber(right, expr.line);
      case "*": return toNumber(left, expr.line) * toNumber(right, expr.line);
      case "/": {
        const d = toNumber(right, expr.line);
        if (d === 0) throw new BreezeError("Cannot divide by zero", expr.line);
        return toNumber(left, expr.line) / d;
      }
      case "%": {
        const d = toNumber(right, expr.line);
        if (d === 0) throw new BreezeError("Cannot mod by zero", expr.line);
        return toNumber(left, expr.line) % d;
      }
      case "==": return this.deepEqual(left, right);
      case "!=": return !this.deepEqual(left, right);
      case "<": return this.compare(left, right, expr.line) < 0;
      case ">": return this.compare(left, right, expr.line) > 0;
      case "<=": return this.compare(left, right, expr.line) <= 0;
      case ">=": return this.compare(left, right, expr.line) >= 0;
    }
    throw new BreezeError(`Unknown operator ${expr.operator}`, expr.line);
  }

  private deepEqual(a: RuntimeValue, b: RuntimeValue): boolean {
    if (typeof a === "number" && typeof b === "number") return a === b;
    if (typeof a === "string" && typeof b === "string") return a === b;
    if (typeof a === "boolean" && typeof b === "boolean") return a === b;
    if (a === null && b === null) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => this.deepEqual(v, b[i]));
    }
    return valueToString(a) === valueToString(b);
  }

  private compare(a: RuntimeValue, b: RuntimeValue, line: number): number {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
    const na = toNumber(a, line);
    const nb = toNumber(b, line);
    return na - nb;
  }

  private evalCall(
    expr: Extract<Expression, { type: "Call" }>,
    env: Environment
  ): RuntimeValue {
    const callee = this.evaluate(expr.callee, env);
    const args = expr.args.map((a) => this.evaluate(a, env));
    if (typeof callee === "object" && callee !== null && "kind" in callee) {
      if ((callee as BuiltinFunction).kind === "builtin") {
        return (callee as BuiltinFunction).fn(args, expr.line);
      }
      if ((callee as BreezeFunction).kind === "function") {
        const fn = callee as BreezeFunction;
        if (args.length !== fn.params.length) {
          throw new BreezeError(
            `Function ${fn.name}() needs ${fn.params.length} value${fn.params.length === 1 ? "" : "s"} but got ${args.length}`,
            expr.line
          );
        }
        const callEnv = new Environment(fn.closure);
        fn.params.forEach((p, i) => callEnv.define(p, args[i]));
        try {
          for (const s of fn.body) this.execute(s, callEnv);
        } catch (e) {
          if (e instanceof ReturnSignal) return e.value;
          throw e;
        }
        return null;
      }
    }
    throw new BreezeError(`Cannot call ${typeName(callee)}`, expr.line);
  }

  private evalIndex(
    expr: Extract<Expression, { type: "Index" }>,
    env: Environment
  ): RuntimeValue {
    const obj = this.evaluate(expr.object, env);
    const idx = this.evaluate(expr.index, env);
    if (Array.isArray(obj)) {
      let i = Math.floor(toNumber(idx, expr.line));
      if (i < 0) i += obj.length;
      if (i < 0 || i >= obj.length) {
        throw new BreezeError(`List index ${Math.floor(toNumber(idx, expr.line))} is out of range (length ${obj.length})`, expr.line);
      }
      return obj[i];
    }
    if (typeof obj === "string") {
      let i = Math.floor(toNumber(idx, expr.line));
      if (i < 0) i += obj.length;
      if (i < 0 || i >= obj.length) {
        throw new BreezeError(`Text index ${Math.floor(toNumber(idx, expr.line))} is out of range (length ${obj.length})`, expr.line);
      }
      return obj[i];
    }
    throw new BreezeError(`Cannot get item from ${typeName(obj)}`, expr.line);
  }
}

export { valueToString };
