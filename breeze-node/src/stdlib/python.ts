// python stdlib: run, exec, call, version, eval. Shells out to python3.

import { execFileSync } from "child_process";
import { ObjectValue, RuntimeValue, BuiltinFunction, BreezeError } from "../types";

function makeBuiltin(
  name: string,
  fn: (args: RuntimeValue[], line: number) => RuntimeValue
): [string, BuiltinFunction] {
  return [name, { kind: "builtin", name, fn }];
}

function toText(v: RuntimeValue): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null) return "none";
  if (Array.isArray(v)) return "[" + v.map(toText).join(", ") + "]";
  return String(v);
}

function toPythonLiteral(v: RuntimeValue): string {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") {
    return String(v);
  }
  if (typeof v === "string") {
    // Backslash first, then quote, then control chars — order matters.
    const escaped = v
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r");
    return `'${escaped}'`;
  }
  if (Array.isArray(v)) {
    return "[" + v.map(toPythonLiteral).join(", ") + "]";
  }
  // Functions and namespaces have no literal form; pass as their text.
  return toPythonLiteral(toText(v));
}

// execFileSync passes args directly as argv — no shell, no quoting issues.
// ENOENT (python3 missing) becomes a friendly BreezeError.
function runPython(args: string[], kind: string, line: number): string {
  let stdout: string;
  try {
    stdout = execFileSync("python3", args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException & {
      stderr?: string | Buffer;
      status?: number;
    };
    if (err.code === "ENOENT") {
      throw new BreezeError(
        `python.${kind}() needs Python 3 installed. Install it from https://python.org`,
        line
      );
    }
    const stderrText =
      typeof err.stderr === "string"
        ? err.stderr
        : err.stderr
        ? err.stderr.toString("utf8")
        : "";
    const detail = (stderrText || err.message || String(e)).trim();
    throw new BreezeError(
      `python.${kind}() failed (python3 exited with code ${err.status ?? "?"}): ${detail}`,
      line
    );
  }
  return stdout;
}

// base64 lets user code contain any character without argv-encoding worries.
function pythonExecB64(source: string): string {
  const b64 = Buffer.from(source, "utf8").toString("base64");
  return `import base64; exec(base64.b64decode("${b64}").decode("utf-8"))`;
}

export function createPythonObject(): ObjectValue {
  const props = new Map<string, RuntimeValue>([
    makeBuiltin("run", (args, line) => {
      if (args.length !== 1) throw new BreezeError("python.run() needs 1 code string", line);
      const code = toText(args[0]);
      return runPython(["-c", pythonExecB64(code)], "run", line);
    }),
    makeBuiltin("exec", (args, line) => {
      if (args.length !== 1) throw new BreezeError("python.exec() needs 1 file path", line);
      const file = toText(args[0]);
      return runPython([file], "exec", line);
    }),
    makeBuiltin("call", (args, line) => {
      if (args.length !== 3) {
        throw new BreezeError(
          "python.call() needs (module, function, args_list)",
          line
        );
      }
      const module = toText(args[0]);
      const fnName = toText(args[1]);
      if (!Array.isArray(args[2])) {
        throw new BreezeError("python.call() needs args to be a list", line);
      }
      const argList = args[2] as RuntimeValue[];
      // Validate identifiers against a safe pattern so user input can't inject code;
      // arguments themselves are converted to literals.
      if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(module)) {
        throw new BreezeError(
          `python.call() module name '${module}' is not a valid Python identifier`,
          line
        );
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fnName)) {
        throw new BreezeError(
          `python.call() function name '${fnName}' is not a valid Python identifier`,
          line
        );
      }
      const pyArgs = argList.map(toPythonLiteral).join(", ");
      const pySource =
        `import ${module} as _m\n` +
        `_r = _m.${fnName}(${pyArgs})\n` +
        `print(_r)\n`;
      return runPython(["-c", pythonExecB64(pySource)], "call", line);
    }),
    makeBuiltin("version", (args, line) => {
      if (args.length !== 0) throw new BreezeError("python.version() takes no arguments", line);
      // python3 --version prints to stdout on 3.4+.
      return runPython(["--version"], "version", line).trim();
    }),
    makeBuiltin("eval", (args, line) => {
      if (args.length !== 1) throw new BreezeError("python.eval() needs 1 expression string", line);
      const expr = toText(args[0]);
      const pySource = `print(${expr})`;
      return runPython(["-c", pythonExecB64(pySource)], "eval", line);
    }),
  ]);

  return { kind: "object", props };
}
