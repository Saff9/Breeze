// math stdlib: sqrt, pow, sin, cos, tan, log, exp, min, max; constants pi, e, tau.

import { ObjectValue, RuntimeValue, BuiltinFunction } from "../types";

function makeBuiltin(
  name: string,
  fn: (args: RuntimeValue[], line: number) => RuntimeValue
): [string, BuiltinFunction] {
  return [name, { kind: "builtin", name, fn }];
}

function toNumber(v: RuntimeValue, line: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (isNaN(n)) throw new Error(`Cannot convert "${v}" to a number (line ${line})`);
    return n;
  }
  throw new Error(`Cannot convert to number (line ${line})`);
}

export function createMathObject(): ObjectValue {
  const props = new Map<string, RuntimeValue>([
    makeBuiltin("sqrt", (args, line) => {
      if (args.length !== 1) throw new Error("math.sqrt() needs 1 number");
      return Math.sqrt(toNumber(args[0], line));
    }),
    makeBuiltin("pow", (args, line) => {
      if (args.length !== 2) throw new Error("math.pow() needs 2 numbers");
      return Math.pow(toNumber(args[0], line), toNumber(args[1], line));
    }),
    makeBuiltin("sin", (args, line) => {
      if (args.length !== 1) throw new Error("math.sin() needs 1 number");
      return Math.sin(toNumber(args[0], line));
    }),
    makeBuiltin("cos", (args, line) => {
      if (args.length !== 1) throw new Error("math.cos() needs 1 number");
      return Math.cos(toNumber(args[0], line));
    }),
    makeBuiltin("tan", (args, line) => {
      if (args.length !== 1) throw new Error("math.tan() needs 1 number");
      return Math.tan(toNumber(args[0], line));
    }),
    makeBuiltin("log", (args, line) => {
      if (args.length !== 1) throw new Error("math.log() needs 1 number");
      return Math.log(toNumber(args[0], line));
    }),
    makeBuiltin("exp", (args, line) => {
      if (args.length !== 1) throw new Error("math.exp() needs 1 number");
      return Math.exp(toNumber(args[0], line));
    }),
    makeBuiltin("min", (args, line) => {
      if (args.length < 1) throw new Error("math.min() needs at least 1 number");
      let r = toNumber(args[0], line);
      for (let i = 1; i < args.length; i++) {
        const n = toNumber(args[i], line);
        if (n < r) r = n;
      }
      return r;
    }),
    makeBuiltin("max", (args, line) => {
      if (args.length < 1) throw new Error("math.max() needs at least 1 number");
      let r = toNumber(args[0], line);
      for (let i = 1; i < args.length; i++) {
        const n = toNumber(args[i], line);
        if (n > r) r = n;
      }
      return r;
    }),
  ]);

  props.set("pi", Math.PI);
  props.set("e", Math.E);
  props.set("tau", Math.PI * 2);

  return { kind: "object", props };
}
