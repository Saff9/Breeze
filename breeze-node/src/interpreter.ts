// Tree-walking interpreter.

import * as fs from "fs";
import * as path from "path";
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
import { tokenize } from "./lexer";
import { Parser } from "./parser";
import { createHttpObject, BreezeCaller } from "./stdlib/http";
import { createJsonObject } from "./stdlib/json";
import { createFsObject } from "./stdlib/fs";
import { createEnvObject } from "./stdlib/env";
import { createTimeObject } from "./stdlib/time";
import { createMathObject } from "./stdlib/math";
import { createPythonObject } from "./stdlib/python";
import { createHtmlObject } from "./stdlib/html";

// Flow control — returned by execute() instead of thrown.
// Throwing for return/break/continue causes stack overflow on deep recursion.
type Flow =
  | { kind: "normal" }
  | { kind: "return"; value: RuntimeValue }
  | { kind: "break" }
  | { kind: "continue" };

const NORMAL: Flow = { kind: "normal" };

const MAX_STEPS = 10_000_000;
// Tree-walking uses ~3 JS frames per Breeze call. V8's default ~1MB stack
// overflows around 300 Breeze frames. We track depth and give a clean error
// before the JS stack crashes.
const MAX_DEPTH = 200;

export interface InterpreterOptions {
  cwd?: string;
  // When true, the interpreter refuses to call sandboxed builtins
  // (fs, env, python, http.get, http.post). http.listen is kept so
  // sandboxed servers can still answer requests.
  sandbox?: boolean;
}

export function valueToString(v: RuntimeValue): string {
  if (v === null) return "none";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    return v.toString();
  }
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return "[" + v.map(valueToString).join(", ") + "]";
  }
  if (typeof v === "object" && v !== null && "kind" in v) {
    const k = (v as { kind: string }).kind;
    if (k === "function" || k === "builtin") {
      const fn = v as BreezeFunction | BuiltinFunction;
      return `<function ${fn.name}>`;
    }
    if (k === "object") {
      const obj = v as ObjectValue;
      return `<object { ${Array.from(obj.props.keys()).join(", ")} }>`;
    }
  }
  return String(v);
}

function typeName(v: RuntimeValue): string {
  if (v === null) return "none";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  if (Array.isArray(v)) return "list";
  if (typeof v === "object" && v !== null && "kind" in v) {
    const k = (v as { kind: string }).kind;
    if (k === "function" || k === "builtin") return "function";
    if (k === "object") return "object";
  }
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
      throw new BreezeError(
        `Cannot convert text "${v}" to a number`,
        line
      );
    }
    return n;
  }
  throw new BreezeError(
    `Cannot convert ${typeName(v)} to a number`,
    line
  );
}

function makeBuiltin(
  name: string,
  fn: (args: RuntimeValue[], line: number) => RuntimeValue
): [string, BuiltinFunction] {
  return [name, { kind: "builtin", name, fn }];
}

function checkArgCount(
  name: string,
  args: RuntimeValue[],
  expected: number,
  line: number
): void {
  if (args.length !== expected) {
    throw new BreezeError(
      `${name}() needs ${expected} value${expected === 1 ? "" : "s"} but got ${args.length}`,
      line
    );
  }
}

function createCoreBuiltins(): Map<string, BuiltinFunction> {
  return new Map<string, BuiltinFunction>([
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
      throw new BreezeError(
        `len() works on text or lists, not ${typeName(v)}`,
        line
      );
    }),
    makeBuiltin("upper", (args, line) => {
      checkArgCount("upper", args, 1, line);
      if (typeof args[0] !== "string") {
        throw new BreezeError("upper() needs text", line);
      }
      return (args[0] as string).toUpperCase();
    }),
    makeBuiltin("lower", (args, line) => {
      checkArgCount("lower", args, 1, line);
      if (typeof args[0] !== "string") {
        throw new BreezeError("lower() needs text", line);
      }
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
      const lo = toNumber(args[0], line);
      const hi = toNumber(args[1], line);
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    }),
    makeBuiltin("sum", (args, line) => {
      checkArgCount("sum", args, 1, line);
      if (!Array.isArray(args[0])) {
        throw new BreezeError("sum() needs a list", line);
      }
      let total = 0;
      for (const item of args[0]) {
        total += toNumber(item, line);
      }
      return total;
    }),
    makeBuiltin("min", (args, line) => {
      if (args.length === 0) {
        throw new BreezeError("min() needs at least one value", line);
      }
      let result = toNumber(args[0], line);
      for (let i = 1; i < args.length; i++) {
        const n = toNumber(args[i], line);
        if (n < result) result = n;
      }
      return result;
    }),
    makeBuiltin("max", (args, line) => {
      if (args.length === 0) {
        throw new BreezeError("max() needs at least one value", line);
      }
      let result = toNumber(args[0], line);
      for (let i = 1; i < args.length; i++) {
        const n = toNumber(args[i], line);
        if (n > result) result = n;
      }
      return result;
    }),
    makeBuiltin("push", (args, line) => {
      checkArgCount("push", args, 2, line);
      if (!Array.isArray(args[0])) {
        throw new BreezeError("push() needs a list first", line);
      }
      (args[0] as RuntimeValue[]).push(args[1]);
      return args[0];
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
      if (!Array.isArray(args[0])) {
        throw new BreezeError("join() needs a list first", line);
      }
      if (typeof args[1] !== "string") {
        throw new BreezeError("join() needs text as the separator", line);
      }
      return (args[0] as RuntimeValue[]).map(valueToString).join(args[1] as string);
    }),
    makeBuiltin("split", (args, line) => {
      checkArgCount("split", args, 2, line);
      if (typeof args[0] !== "string") {
        throw new BreezeError("split() needs text first", line);
      }
      if (typeof args[1] !== "string") {
        throw new BreezeError("split() needs text as the separator", line);
      }
      return (args[0] as string).split(args[1] as string);
    }),
    makeBuiltin("contains", (args, line) => {
      checkArgCount("contains", args, 2, line);
      if (typeof args[0] === "string" && typeof args[1] === "string") {
        return (args[0] as string).includes(args[1] as string);
      }
      if (Array.isArray(args[0])) {
        return (args[0] as RuntimeValue[]).some((v) => valueToString(v) === valueToString(args[1]));
      }
      throw new BreezeError("contains() needs text or a list first", line);
    }),
    makeBuiltin("trim", (args, line) => {
      checkArgCount("trim", args, 1, line);
      if (typeof args[0] !== "string") {
        throw new BreezeError("trim() needs text", line);
      }
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
      if (args.length < 2 || args.length > 3) {
        throw new BreezeError("slice() needs 2 or 3 values", line);
      }
      if (typeof args[0] !== "string") {
        throw new BreezeError("slice() needs text first", line);
      }
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
      if (typeof args[0] !== "string") {
        throw new BreezeError("repeat_text() needs text first", line);
      }
      const n = Math.floor(toNumber(args[1], line));
      if (n < 0) {
        throw new BreezeError("repeat_text() count cannot be negative", line);
      }
      return (args[0] as string).repeat(n);
    }),
  ]);
}

export class Interpreter {
  private builtinEnv: Environment;
  private output: string[] = [];
  private steps: number = 0;
  private depth: number = 0;
  private cwd: string;
  private sandbox: boolean;
  private fileStack: string[] = [];
  private loadedModules: Map<string, Map<string, RuntimeValue>> = new Map();
  private currentExports: Map<string, RuntimeValue> | null = null;
  private lastExports: Map<string, RuntimeValue> = new Map();
  private caller: BreezeCaller;

  constructor(options: InterpreterOptions = {}) {
    this.cwd = options.cwd || process.cwd();
    this.sandbox = !!options.sandbox;
    this.builtinEnv = new Environment();
    this.caller = (fn, args, line) => this.callValue(fn, args, line);
    this.installBuiltins();
  }

  // Build a stub object that throws a BreezeError naming the disabled
  // function (e.g. "fs.read() is not available in sandbox mode") when any
  // of its methods is called. Used in sandbox mode in place of fs/env/python.
  private createSandboxStub(prefix: string, methods: string[]): ObjectValue {
    const props = new Map<string, RuntimeValue>();
    for (const name of methods) {
      const [, fn] = makeBuiltin(name, (_args, line) => {
        throw new BreezeError(
          `${prefix}.${name}() is not available in sandbox mode`,
          line
        );
      });
      props.set(name, fn);
    }
    return { kind: "object", props };
  }

  private installBuiltins(): void {
    const core = createCoreBuiltins();
    for (const [name, fn] of core) {
      this.builtinEnv.set(name, fn);
    }

    // http.listen stays available in sandbox mode (so a sandboxed server can
    // still answer requests); http.get and http.post are stubbed out.
    const httpObj = createHttpObject(this.caller);
    if (this.sandbox) {
      const [, sandboxGet] = makeBuiltin("get", (_args, line) => {
        throw new BreezeError(
          "http.get() is not available in sandbox mode",
          line
        );
      });
      const [, sandboxPost] = makeBuiltin("post", (_args, line) => {
        throw new BreezeError(
          "http.post() is not available in sandbox mode",
          line
        );
      });
      httpObj.props.set("get", sandboxGet);
      httpObj.props.set("post", sandboxPost);
    }
    this.builtinEnv.set("http", httpObj);

    this.builtinEnv.set("json", createJsonObject());

    if (this.sandbox) {
      this.builtinEnv.set(
        "fs",
        this.createSandboxStub("fs", [
          "read",
          "write",
          "append",
          "exists",
          "list",
          "remove",
          "mkdir",
        ])
      );
      this.builtinEnv.set(
        "env",
        this.createSandboxStub("env", ["get", "set", "list"])
      );
      this.builtinEnv.set(
        "python",
        this.createSandboxStub("python", [
          "run",
          "exec",
          "call",
          "version",
          "eval",
        ])
      );
    } else {
      this.builtinEnv.set("fs", createFsObject());
      this.builtinEnv.set("env", createEnvObject());
      this.builtinEnv.set("python", createPythonObject());
    }

    this.builtinEnv.set("time", createTimeObject());
    this.builtinEnv.set("math", createMathObject());
    this.builtinEnv.set("html", createHtmlObject());
  }

  run(program: Program): string[] {
    const globalEnv = new Environment(this.builtinEnv);
    this.fileStack = [this.cwd];
    this.lastExports = this.runProgramBody(program, globalEnv);
    return this.output;
  }

  getExport(name: string): RuntimeValue | undefined {
    return this.lastExports.get(name);
  }

  // Lets host Node code invoke Breeze functions returned by getExport.
  callFunction(fn: RuntimeValue, args: RuntimeValue[]): RuntimeValue {
    return this.callValue(fn, args, 0);
  }

  private runProgramBody(
    program: Program,
    env: Environment
  ): Map<string, RuntimeValue> {
    const exports = new Map<string, RuntimeValue>();
    const prevExports = this.currentExports;
    this.currentExports = exports;

    // First pass: collect top-level functions so forward references work.
    for (const stmt of program.body) {
      if (stmt.type === "Func") {
        const fn = this.makeFunction(stmt, env);
        env.set(stmt.name, fn);
      } else if (stmt.type === "Export" && stmt.declaration.type === "Func") {
        const fn = this.makeFunction(stmt.declaration, env);
        env.set(stmt.declaration.name, fn);
      }
    }

    // Second pass: execute top-level statements in order.
    for (const stmt of program.body) {
      if (stmt.type === "Func") continue;
      const f = this.execute(stmt, env);
      if (f.kind === "return") break;
    }

    this.currentExports = prevExports;
    return exports;
  }

  private makeFunction(
    stmt: Extract<Statement, { type: "Func" }>,
    env: Environment
  ): BreezeFunction {
    return {
      kind: "function",
      name: stmt.name,
      params: stmt.params,
      body: stmt.body,
      closure: env,
    };
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

  private execute(stmt: Statement, env: Environment): Flow {
    this.tick(stmt.line);

    switch (stmt.type) {
      case "Show": {
        const parts = stmt.args.map((a) => valueToString(this.evaluate(a, env)));
        this.output.push(parts.join(" "));
        return NORMAL;
      }
      case "ExpressionStatement": {
        this.evaluate(stmt.expression, env);
        return NORMAL;
      }
      case "Assignment": {
        const value = this.evaluate(stmt.value, env);
        this.assign(stmt.target, value, env, stmt.line);
        return NORMAL;
      }
      case "If": {
        const test = this.evaluate(stmt.test, env);
        if (isTruthy(test)) {
          for (const s of stmt.consequent) {
            const f = this.execute(s, env);
            if (f.kind !== "normal") return f;
          }
          return NORMAL;
        }
        for (const elif of stmt.elifs) {
          const elifTest = this.evaluate(elif.test, env);
          if (isTruthy(elifTest)) {
            for (const s of elif.body) {
              const f = this.execute(s, env);
              if (f.kind !== "normal") return f;
            }
            return NORMAL;
          }
        }
        for (const s of stmt.alternate) {
          const f = this.execute(s, env);
          if (f.kind !== "normal") return f;
        }
        return NORMAL;
      }
      case "While": {
        while (isTruthy(this.evaluate(stmt.test, env))) {
          let brk = false;
          for (const s of stmt.body) {
            const f = this.execute(s, env);
            if (f.kind === "break") { brk = true; break; }
            if (f.kind === "continue") break;
            if (f.kind === "return") return f;
          }
          if (brk) break;
        }
        return NORMAL;
      }
      case "Repeat": {
        const count = Math.floor(toNumber(this.evaluate(stmt.count, env), stmt.line));
        if (count < 0) {
          throw new BreezeError("repeat count cannot be negative", stmt.line);
        }
        for (let i = 0; i < count; i++) {
          let brk = false;
          for (const s of stmt.body) {
            const f = this.execute(s, env);
            if (f.kind === "break") { brk = true; break; }
            if (f.kind === "continue") break;
            if (f.kind === "return") return f;
          }
          if (brk) break;
        }
        return NORMAL;
      }
      case "RepeatRange": {
        const from = Math.floor(toNumber(this.evaluate(stmt.from, env), stmt.line));
        const to = Math.floor(toNumber(this.evaluate(stmt.to, env), stmt.line));
        for (let i = from; i <= to; i++) {
          env.define(stmt.variable, i);
          let brk = false;
          for (const s of stmt.body) {
            const f = this.execute(s, env);
            if (f.kind === "break") { brk = true; break; }
            if (f.kind === "continue") break;
            if (f.kind === "return") return f;
          }
          if (brk) break;
        }
        return NORMAL;
      }
      case "For": {
        const iterable = this.evaluate(stmt.iterable, env);
        if (!Array.isArray(iterable)) {
          throw new BreezeError(
            `for needs a list, not ${typeName(iterable)}`,
            stmt.line
          );
        }
        for (const item of iterable) {
          env.define(stmt.variable, item);
          let brk = false;
          for (const s of stmt.body) {
            const f = this.execute(s, env);
            if (f.kind === "break") { brk = true; break; }
            if (f.kind === "continue") break;
            if (f.kind === "return") return f;
          }
          if (brk) break;
        }
        return NORMAL;
      }
      case "Func": {
        const fn = this.makeFunction(stmt, env);
        env.set(stmt.name, fn);
        return NORMAL;
      }
      case "Return": {
        const value = stmt.value ? this.evaluate(stmt.value, env) : null;
        return { kind: "return", value };
      }
      case "Break": {
        return { kind: "break" };
      }
      case "Continue": {
        return { kind: "continue" };
      }
      case "Try": {
        try {
          for (const s of stmt.body) {
            const f = this.execute(s, env);
            if (f.kind !== "normal") return f;
          }
          return NORMAL;
        } catch (e) {
          if (e instanceof BreezeError) {
            const catchEnv = new Environment(env);
            catchEnv.define(stmt.catchVar, e.message);
            for (const s of stmt.catchBody) {
              const f = this.execute(s, catchEnv);
              if (f.kind !== "normal") return f;
            }
            return NORMAL;
          }
          throw e;
        }
      }
      case "Import": {
        this.executeImport(stmt, env);
        return NORMAL;
      }
      case "Export": {
        this.executeExport(stmt, env);
        return NORMAL;
      }
    }
  }

  private executeImport(stmt: ImportStatement, env: Environment): void {
    const dir = this.fileStack[this.fileStack.length - 1] || this.cwd;

    // Local imports start with ./, ../, or an absolute path; anything else is
    // a package import resolved against breeze_modules/.
    let fullPath: string;
    if (
      stmt.path.startsWith("./") ||
      stmt.path.startsWith("../") ||
      stmt.path.startsWith("/")
    ) {
      fullPath = path.resolve(dir, stmt.path);
      if (!fullPath.endsWith(".bz")) fullPath += ".bz";
    } else {
      fullPath = this.resolvePackage(stmt.path, dir, stmt.line);
    }

    let exports: Map<string, RuntimeValue>;
    if (this.loadedModules.has(fullPath)) {
      exports = this.loadedModules.get(fullPath)!;
    } else {
      if (!fs.existsSync(fullPath)) {
        throw new BreezeError(
          `Module not found: ${stmt.path} (resolved to ${fullPath})`,
          stmt.line
        );
      }
      const source = fs.readFileSync(fullPath, "utf8");

      let program: Program;
      try {
        const tokens = tokenize(source);
        const parser = new Parser(tokens);
        program = parser.parse();
      } catch (e) {
        if (e instanceof BreezeError) {
          throw new BreezeError(
            `Error in module ${stmt.path} (line ${e.line}): ${e.message}`,
            stmt.line
          );
        }
        throw e;
      }

      const moduleEnv = new Environment(this.builtinEnv);
      this.fileStack.push(path.dirname(fullPath));
      try {
        exports = this.runProgramBody(program, moduleEnv);
      } finally {
        this.fileStack.pop();
      }
      this.loadedModules.set(fullPath, exports);
    }

    for (const name of stmt.names) {
      if (!exports.has(name)) {
        throw new BreezeError(
          `Module ${stmt.path} does not export '${name}'`,
          stmt.line
        );
      }
      env.set(name, exports.get(name)!);
    }
  }

  // Walk up from fromDir looking for breeze_modules/<name>/; reads its
  // breeze.json to pick the entry file (default main.bz). Lets deeply nested
  // files import packages installed at the project root.
  private resolvePackage(name: string, fromDir: string, line: number): string {
    let dir = fromDir;
    while (true) {
      const candidate = path.join(dir, "breeze_modules", name);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        let entry = "main.bz";
        const manifestPath = path.join(candidate, "breeze.json");
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            if (typeof manifest.entry === "string" && manifest.entry) {
              entry = manifest.entry;
            }
          } catch {
            // Malformed manifest: fall back to the default entry.
          }
        }
        let entryPath = path.resolve(candidate, entry);
        if (!entryPath.endsWith(".bz")) entryPath += ".bz";
        return entryPath;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break; // filesystem root
      dir = parent;
    }
    throw new BreezeError(
      `Package not found: '${name}'. Run 'breeze install ${name}' first.`,
      line
    );
  }

  private executeExport(
    stmt: ExportStatement,
    env: Environment
  ): void {
    const decl = stmt.declaration;
    if (decl.type === "Func") {
      // Already defined during the first pass; just expose it.
      if (this.currentExports) {
        const v = env.get(decl.name);
        if (v === undefined) {
          throw new BreezeError(
            `Cannot export '${decl.name}' — function not defined`,
            stmt.line
          );
        }
        this.currentExports.set(decl.name, v);
      }
      return;
    }
    if (decl.type === "Assignment") {
      const value = this.evaluate(decl.value, env);
      this.assign(decl.target, value, env, stmt.line);
      if (this.currentExports && decl.target.type === "Identifier") {
        this.currentExports.set(decl.target.name, value);
      }
      return;
    }
    throw new BreezeError("Invalid export declaration", stmt.line);
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
      if (!Array.isArray(obj)) {
        throw new BreezeError(
          `Cannot set item on ${typeName(obj)}`,
          line
        );
      }
      const i = Math.floor(toNumber(idx, line));
      if (i < 0 || i >= obj.length) {
        throw new BreezeError(
          `List index ${i} is out of range (length ${obj.length})`,
          line
        );
      }
      obj[i] = value;
      return;
    }
    throw new BreezeError("Invalid assignment target", line);
  }

  private evaluate(expr: Expression, env: Environment): RuntimeValue {
    this.tick(expr.line);

    switch (expr.type) {
      case "Literal":
        return expr.value;
      case "Identifier": {
        const v = env.get(expr.name);
        if (v === undefined) {
          throw new BreezeError(
            `Name '${expr.name}' is not defined`,
            expr.line
          );
        }
        return v;
      }
      case "List":
        return expr.elements.map((e) => this.evaluate(e, env));
      case "Unary": {
        const v = this.evaluate(expr.operand, env);
        if (expr.operator === "-") {
          return -toNumber(v, expr.line);
        }
        if (expr.operator === "not") {
          return !isTruthy(v);
        }
        throw new BreezeError(`Unknown operator ${expr.operator}`, expr.line);
      }
      case "Binary":
        return this.evalBinary(expr, env);
      case "Call":
        return this.evalCall(expr, env);
      case "Index":
        return this.evalIndex(expr, env);
      case "Member":
        return this.evalMember(expr, env);
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
        if (typeof left === "number" && typeof right === "number") {
          return left + right;
        }
        // string + anything: auto-converts, unlike Python.
        if (typeof left === "string" || typeof right === "string") {
          return valueToString(left) + valueToString(right);
        }
        if (Array.isArray(left) && Array.isArray(right)) {
          return [...left, ...right];
        }
        throw new BreezeError(
          `Cannot add ${typeName(left)} and ${typeName(right)}`,
          expr.line
        );
      }
      case "-":
        return toNumber(left, expr.line) - toNumber(right, expr.line);
      case "*":
        return toNumber(left, expr.line) * toNumber(right, expr.line);
      case "/": {
        const r = toNumber(right, expr.line);
        if (r === 0) {
          throw new BreezeError("Cannot divide by zero", expr.line);
        }
        return toNumber(left, expr.line) / r;
      }
      case "%": {
        const r = toNumber(right, expr.line);
        if (r === 0) {
          throw new BreezeError("Cannot mod by zero", expr.line);
        }
        return toNumber(left, expr.line) % r;
      }
      case "==":
        return this.deepEqual(left, right);
      case "!=":
        return !this.deepEqual(left, right);
      case "<":
        return this.compare(left, right, expr.line) < 0;
      case ">":
        return this.compare(left, right, expr.line) > 0;
      case "<=":
        return this.compare(left, right, expr.line) <= 0;
      case ">=":
        return this.compare(left, right, expr.line) >= 0;
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
    // Cross-type equality falls back to string form.
    return valueToString(a) === valueToString(b);
  }

  private compare(
    a: RuntimeValue,
    b: RuntimeValue,
    line: number
  ): number {
    if (typeof a === "number" && typeof b === "number") {
      return a - b;
    }
    if (typeof a === "string" && typeof b === "string") {
      return a < b ? -1 : a > b ? 1 : 0;
    }
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
    return this.callValue(callee, args, expr.line);
  }

  // Called from evalCall and from stdlib callers (http.listen).
  private callValue(
    callee: RuntimeValue,
    args: RuntimeValue[],
    line: number
  ): RuntimeValue {
    if (
      typeof callee === "object" &&
      callee !== null &&
      "kind" in callee
    ) {
      if (callee.kind === "builtin") {
        return callee.fn(args, line);
      }
      if (callee.kind === "function") {
        const fn = callee as BreezeFunction;
        if (args.length !== fn.params.length) {
          throw new BreezeError(
            `Function ${fn.name}() needs ${fn.params.length} value${fn.params.length === 1 ? "" : "s"} but got ${args.length}`,
            line
          );
        }
        const callEnv = new Environment(fn.closure);
        fn.params.forEach((p, i) => callEnv.define(p, args[i]));
        this.depth++;
        if (this.depth > MAX_DEPTH) {
          this.depth--;
          throw new BreezeError(
            `Maximum recursion depth (${MAX_DEPTH}) exceeded — possible infinite recursion. For deeper recursion, run with: node --stack-size=4096`,
            line
          );
        }
        try {
          for (const s of fn.body) {
            const f = this.execute(s, callEnv);
            if (f.kind === "return") return f.value;
          }
        } finally {
          this.depth--;
        }
        return null;
      }
    }
    throw new BreezeError(`Cannot call ${typeName(callee)}`, line);
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
        throw new BreezeError(
          `List index ${Math.floor(toNumber(idx, expr.line))} is out of range (length ${obj.length})`,
          expr.line
        );
      }
      return obj[i];
    }
    if (typeof obj === "string") {
      let i = Math.floor(toNumber(idx, expr.line));
      if (i < 0) i += obj.length;
      if (i < 0 || i >= obj.length) {
        throw new BreezeError(
          `Text index ${Math.floor(toNumber(idx, expr.line))} is out of range (length ${obj.length})`,
          expr.line
        );
      }
      return obj[i];
    }
    throw new BreezeError(
      `Cannot get item from ${typeName(obj)}`,
      expr.line
    );
  }

  private evalMember(
    expr: Extract<Expression, { type: "Member" }>,
    env: Environment
  ): RuntimeValue {
    const obj = this.evaluate(expr.object, env);
    if (
      typeof obj === "object" &&
      obj !== null &&
      "kind" in obj &&
      (obj as { kind: string }).kind === "object"
    ) {
      const objectValue = obj as ObjectValue;
      if (!objectValue.props.has(expr.property)) {
        throw new BreezeError(
          `'${expr.property}' is not available on this object`,
          expr.line
        );
      }
      return objectValue.props.get(expr.property)!;
    }
    throw new BreezeError(
      `Cannot get member '${expr.property}' from ${typeName(obj)}`,
      expr.line
    );
  }
}
