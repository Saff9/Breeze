// env stdlib: get, set, list.

import { ObjectValue, RuntimeValue, BuiltinFunction } from "../types";

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
  return String(v);
}

export function createEnvObject(): ObjectValue {
  const props = new Map<string, RuntimeValue>([
    makeBuiltin("get", (args) => {
      if (args.length !== 1) throw new Error("env.get() needs 1 name");
      const name = toText(args[0]);
      const v = process.env[name];
      if (v === undefined) return null;
      return v;
    }),
    makeBuiltin("set", (args) => {
      if (args.length !== 2) throw new Error("env.set() needs a name and a value");
      const name = toText(args[0]);
      const value = toText(args[1]);
      process.env[name] = value;
      return null;
    }),
    makeBuiltin("list", (args) => {
      if (args.length !== 0) throw new Error("env.list() takes no arguments");
      return Object.keys(process.env);
    }),
  ]);

  return { kind: "object", props };
}
