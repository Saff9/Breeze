// Vercel serverless function wrapper for a Breeze HTTP app.
//
// Place this file at `api/index.ts` in your Vercel project. It loads your
// Breeze program (which calls `http.listen` or exports a `handle` function),
// then bridges incoming Vercel requests to your Breeze handler.
//
// The Breeze program MUST export a function called `handle` that takes a
// request object and returns a response object. Do NOT call `http.listen`
// in a Vercel deployment — Vercel manages the server for you.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { run } = require("breeze-lang");

// Cache the interpreter + exports across warm invocations.
let cached: { handle: (req: unknown) => unknown } | null = null;

function load() {
  if (cached) return cached;
  // Path to your Breeze entry point. Adjust if needed.
  const file = join(process.cwd(), "src", "main.bz");
  const source = readFileSync(file, "utf-8");
  const result = run(source, { cwd: join(process.cwd(), "src") });
  if (result.error) {
    throw new Error(`Breeze load error (line ${result.errorLine}): ${result.error}`);
  }
  // The Breeze program must `export func handle(req): ...`.
  const handle = (result as { getExport?: (n: string) => unknown }).getExport?.("handle") as
    | ((req: unknown) => unknown)
    | undefined;
  if (!handle) {
    throw new Error("Breeze program does not export a `handle` function. Add: export func handle(req): ...");
  }
  cached = { handle };
  return cached;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { handle } = load();
    const body = req.body ? JSON.stringify(req.body) : "";
    const breezeReq = [
      ["method", req.method || "GET"],
      ["path", req.url || "/"],
      ["body", body],
      ["headers", Object.entries(req.headers).map(([k, v]) => [k, String(v)])],
    ];
    const response = handle(breezeReq) as unknown[][];
    const status = response.find((p) => p[0] === "status")?.[1] ?? 200;
    const headers = (response.find((p) => p[0] === "headers")?.[1] ?? []) as [string, string][];
    const responseBody = response.find((p) => p[0] === "body")?.[1] ?? "";
    for (const [k, v] of headers) {
      res.setHeader(k, v);
    }
    res.status(status as number).send(responseBody);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
}
