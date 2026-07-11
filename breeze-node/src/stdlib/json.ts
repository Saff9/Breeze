// json stdlib: parse, stringify, get, set, keys, values, has.
// Objects are represented as lists of [key, value] pairs.

import { ObjectValue, RuntimeValue, BuiltinFunction } from "../types";

function makeBuiltin(
  name: string,
  fn: (args: RuntimeValue[], line: number) => RuntimeValue
): [string, BuiltinFunction] {
  return [name, { kind: "builtin", name, fn }];
}

// A list of pairs becomes a JSON object; any other list becomes an array.
function toJson(v: RuntimeValue): unknown {
  if (v === null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    if (v.length > 0 && v.every(isPair)) {
      const obj: Record<string, unknown> = {};
      for (const item of v) {
        const pair = item as RuntimeValue[];
        obj[pair[0] as string] = toJson(pair[1]);
      }
      return obj;
    }
    return v.map(toJson);
  }
  // Functions and namespaces have no JSON form.
  throw new Error("Cannot convert this value to JSON");
}

function isPair(v: RuntimeValue): boolean {
  if (!Array.isArray(v)) return false;
  if (v.length !== 2) return false;
  return typeof v[0] === "string";
}

// JS objects become lists of [key, value] pairs.
function fromJson(v: unknown): RuntimeValue {
  if (v === null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v.map(fromJson);
  }
  if (typeof v === "object") {
    const pairs: RuntimeValue[] = [];
    for (const k of Object.keys(v as Record<string, unknown>)) {
      pairs.push([k, fromJson((v as Record<string, unknown>)[k])]);
    }
    return pairs;
  }
  return null;
}

function toText(v: RuntimeValue): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null) return "none";
  return String(v);
}

export function createJsonObject(): ObjectValue {
  const props = new Map<string, RuntimeValue>([
    makeBuiltin("parse", (args, line) => {
      if (args.length !== 1) throw new Error("json.parse() needs 1 text");
      const text = toText(args[0]);
      try {
        const parsed = JSON.parse(text);
        return fromJson(parsed);
      } catch (e) {
        throw new Error(
          `json.parse() failed: ${e instanceof Error ? e.message : String(e)} (line ${line})`
        );
      }
    }),
    makeBuiltin("stringify", (args, line) => {
      if (args.length !== 1) throw new Error("json.stringify() needs 1 value");
      try {
        return JSON.stringify(toJson(args[0]));
      } catch (e) {
        throw new Error(
          `json.stringify() failed: ${e instanceof Error ? e.message : String(e)} (line ${line})`
        );
      }
    }),
    makeBuiltin("get", (args, line) => {
      if (args.length !== 2) throw new Error("json.get() needs an object and a key");
      const obj = args[0];
      const key = toText(args[1]);
      if (!Array.isArray(obj)) {
        throw new Error(
          `json.get() needs a list-of-pairs, not ${typeof obj} (line ${line})`
        );
      }
      for (const item of obj) {
        if (Array.isArray(item) && item.length === 2 && toText(item[0]) === key) {
          return item[1];
        }
      }
      return null;
    }),
    makeBuiltin("set", (args, line) => {
      if (args.length !== 3) throw new Error("json.set() needs an object, a key, and a value");
      const obj = args[0];
      const key = toText(args[1]);
      const value = args[2];
      if (!Array.isArray(obj)) {
        throw new Error(
          `json.set() needs a list-of-pairs, not ${typeof obj} (line ${line})`
        );
      }
      for (const item of obj) {
        if (Array.isArray(item) && item.length === 2 && toText(item[0]) === key) {
          item[1] = value;
          return obj;
        }
      }
      obj.push([key, value]);
      return obj;
    }),
    makeBuiltin("keys", (args, line) => {
      if (args.length !== 1) throw new Error("json.keys() needs 1 object");
      const obj = args[0];
      if (!Array.isArray(obj)) {
        throw new Error(
          `json.keys() needs a list-of-pairs (line ${line})`
        );
      }
      const keys: RuntimeValue[] = [];
      for (const item of obj) {
        if (Array.isArray(item) && item.length === 2) keys.push(item[0]);
      }
      return keys;
    }),
    makeBuiltin("values", (args, line) => {
      if (args.length !== 1) throw new Error("json.values() needs 1 object");
      const obj = args[0];
      if (!Array.isArray(obj)) {
        throw new Error(
          `json.values() needs a list-of-pairs (line ${line})`
        );
      }
      const values: RuntimeValue[] = [];
      for (const item of obj) {
        if (Array.isArray(item) && item.length === 2) values.push(item[1]);
      }
      return values;
    }),
    makeBuiltin("has", (args, line) => {
      if (args.length !== 2) throw new Error("json.has() needs an object and a key");
      const obj = args[0];
      const key = toText(args[1]);
      if (!Array.isArray(obj)) {
        throw new Error(
          `json.has() needs a list-of-pairs (line ${line})`
        );
      }
      for (const item of obj) {
        if (Array.isArray(item) && item.length === 2 && toText(item[0]) === key) {
          return true;
        }
      }
      return false;
    }),
  ]);

  return { kind: "object", props };
}
