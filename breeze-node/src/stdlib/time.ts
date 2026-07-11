// time stdlib: now, sleep, seconds.

import { ObjectValue, RuntimeValue, BuiltinFunction } from "../types";

function makeBuiltin(
  name: string,
  fn: (args: RuntimeValue[], line: number) => RuntimeValue
): [string, BuiltinFunction] {
  return [name, { kind: "builtin", name, fn }];
}

// Synchronous sleep via Atomics.wait on a shared buffer; no native deps.
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));

function syncSleep(ms: number): void {
  if (ms <= 0) return;
  Atomics.wait(sleepBuffer, 0, 0, ms);
}

export function createTimeObject(): ObjectValue {
  const props = new Map<string, RuntimeValue>([
    makeBuiltin("now", (args) => {
      if (args.length !== 0) throw new Error("time.now() takes no arguments");
      return Date.now();
    }),
    makeBuiltin("sleep", (args, line) => {
      if (args.length !== 1) throw new Error("time.sleep() needs 1 number (milliseconds)");
      const ms = typeof args[0] === "number" ? args[0] : parseFloat(String(args[0]));
      if (isNaN(ms)) throw new Error(`time.sleep() needs a number (line ${line})`);
      syncSleep(Math.floor(ms));
      return null;
    }),
    makeBuiltin("seconds", (args) => {
      if (args.length !== 0) throw new Error("time.seconds() takes no arguments");
      return Math.floor(Date.now() / 1000);
    }),
  ]);

  return { kind: "object", props };
}
