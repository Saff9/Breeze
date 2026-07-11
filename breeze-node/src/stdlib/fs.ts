// fs stdlib: read, write, append, exists, list, remove, mkdir.

import * as nodeFs from "fs";
import * as nodePath from "path";
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

export function createFsObject(): ObjectValue {
  const props = new Map<string, RuntimeValue>([
    makeBuiltin("read", (args) => {
      if (args.length !== 1) throw new Error("fs.read() needs 1 path");
      const path = toText(args[0]);
      try {
        return nodeFs.readFileSync(path, "utf8");
      } catch (e) {
        throw new Error(
          `fs.read() failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }),
    makeBuiltin("write", (args) => {
      if (args.length !== 2) throw new Error("fs.write() needs a path and content");
      const path = toText(args[0]);
      const content = toText(args[1]);
      try {
        nodeFs.mkdirSync(nodePath.dirname(path), { recursive: true });
        nodeFs.writeFileSync(path, content, "utf8");
        return null;
      } catch (e) {
        throw new Error(
          `fs.write() failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }),
    makeBuiltin("append", (args) => {
      if (args.length !== 2) throw new Error("fs.append() needs a path and content");
      const path = toText(args[0]);
      const content = toText(args[1]);
      try {
        nodeFs.mkdirSync(nodePath.dirname(path), { recursive: true });
        nodeFs.appendFileSync(path, content, "utf8");
        return null;
      } catch (e) {
        throw new Error(
          `fs.append() failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }),
    makeBuiltin("exists", (args) => {
      if (args.length !== 1) throw new Error("fs.exists() needs 1 path");
      const path = toText(args[0]);
      return nodeFs.existsSync(path);
    }),
    makeBuiltin("list", (args) => {
      if (args.length !== 1) throw new Error("fs.list() needs 1 path");
      const path = toText(args[0]);
      try {
        return nodeFs.readdirSync(path);
      } catch (e) {
        throw new Error(
          `fs.list() failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }),
    makeBuiltin("remove", (args) => {
      if (args.length !== 1) throw new Error("fs.remove() needs 1 path");
      const path = toText(args[0]);
      try {
        // rmSync handles both files and directories (recursive for dirs).
        nodeFs.rmSync(path, { recursive: true, force: false });
        return null;
      } catch (e) {
        throw new Error(
          `fs.remove() failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }),
    makeBuiltin("mkdir", (args) => {
      if (args.length !== 1) throw new Error("fs.mkdir() needs 1 path");
      const path = toText(args[0]);
      try {
        nodeFs.mkdirSync(path, { recursive: true });
        return null;
      } catch (e) {
        throw new Error(
          `fs.mkdir() failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }),
  ]);

  return { kind: "object", props };
}
