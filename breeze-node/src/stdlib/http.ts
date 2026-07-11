import * as nodeHttp from "http";
import { BreezeError, ObjectValue, RuntimeValue, BuiltinFunction } from "../types";

export type BreezeCaller = (
  fn: RuntimeValue,
  args: RuntimeValue[],
  line: number
) => RuntimeValue;

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

function pairGet(obj: RuntimeValue, key: string): RuntimeValue {
  if (!Array.isArray(obj)) return null;
  for (const item of obj) {
    if (Array.isArray(item) && item.length === 2 && toText(item[0]) === key) {
      return item[1];
    }
  }
  return null;
}

function pairsToRecord(obj: RuntimeValue): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(obj)) return out;
  for (const item of obj) {
    if (Array.isArray(item) && item.length === 2) {
      out[toText(item[0])] = toText(item[1]);
    }
  }
  return out;
}

function parseQuery(rawUrl: string): RuntimeValue[] {
  try {
    const u = new URL(rawUrl, "http://localhost");
    const pairs: RuntimeValue[] = [];
    u.searchParams.forEach((value, key) => {
      pairs.push([key, value]);
    });
    return pairs;
  } catch {
    return [];
  }
}

// Synchronous fetch leveraging worker_threads & SharedArrayBuffer to keep interpreter single-threaded
function syncFetch(
  url: string,
  options: { method?: string; body?: string; headers?: Record<string, string> },
  line: number
): string {
  if (typeof (globalThis as Record<string, unknown>).fetch !== "function") {
    throw new BreezeError(
      "http.get/post requires Node.js 18 or later.",
      line
    );
  }

  const { Worker, isMainThread, workerData } = (() => {
    try {
      return require("worker_threads") as typeof import("worker_threads");
    } catch {
      throw new BreezeError("http.get/post requires Node.js with worker_threads support", line);
    }
  })();

  if (!isMainThread) {
    const { url: wUrl, options: wOpts, sharedBuf } = workerData as {
      url: string;
      options: { method?: string; body?: string; headers?: Record<string, string> };
      sharedBuf: SharedArrayBuffer;
    };
    const flag = new Int32Array(sharedBuf, 0, 1);
    const resultBuf = new Uint8Array(sharedBuf, 4);

    (async () => {
      try {
        const res = await fetch(wUrl, {
          method: wOpts.method || "GET",
          body: wOpts.body,
          headers: wOpts.headers,
        });
        const text = await res.text();
        const encoded = Buffer.from(text, "utf8");
        const view = new DataView(sharedBuf, 4);
        view.setUint32(0, encoded.length, true);
        resultBuf.set(encoded, 4);
        Atomics.store(flag, 0, 1);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const encoded = Buffer.from(msg, "utf8");
        const view = new DataView(sharedBuf, 4);
        view.setUint32(0, encoded.length, true);
        resultBuf.set(encoded, 4);
        Atomics.store(flag, 0, 2);
      }
      Atomics.notify(flag, 0);
    })();
    return "";
  }

  const MAX_BODY = 16 * 1024 * 1024;
  const sharedBuf = new SharedArrayBuffer(4 + 4 + MAX_BODY);
  const flag = new Int32Array(sharedBuf, 0, 1);
  Atomics.store(flag, 0, 0);

  const worker = new Worker(__filename, {
    workerData: { url, options, sharedBuf },
    eval: false,
  });

  Atomics.wait(flag, 0, 0);
  worker.terminate();

  const status = Atomics.load(flag, 0);
  const view = new DataView(sharedBuf, 4);
  const len = view.getUint32(0, true);
  const body = Buffer.from(new Uint8Array(sharedBuf, 8, len)).toString("utf8");

  if (status === 2) {
    throw new BreezeError(`http request failed: ${body}`, line);
  }
  return body;
}

export function createHttpObject(caller: BreezeCaller): ObjectValue {
  const props = new Map<string, RuntimeValue>([
    makeBuiltin("listen", (args, line) => {
      if (args.length !== 2) {
        throw new BreezeError("http.listen() needs a port and a handler function", line);
      }
      const rawPort = args[0];
      const port =
        typeof rawPort === "number"
          ? rawPort
          : parseInt(toText(rawPort), 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        throw new BreezeError(
          `http.listen() port must be a number between 1 and 65535, got: ${toText(rawPort)}`,
          line
        );
      }

      const handler = args[1];
      if (
        typeof handler !== "object" ||
        handler === null ||
        !("kind" in handler) ||
        (handler as { kind: string }).kind !== "function"
      ) {
        throw new BreezeError(
          "http.listen() second argument must be a function",
          line
        );
      }

      const server = nodeHttp.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");

          const headerPairs: RuntimeValue[] = [];
          for (const [k, v] of Object.entries(req.headers)) {
            if (Array.isArray(v)) {
              headerPairs.push([k, v.join(",")]);
            } else if (v !== undefined) {
              headerPairs.push([k, v]);
            }
          }

          const rawUrl = req.url || "/";
          let cleanPath = rawUrl;
          const queryPairs = parseQuery(rawUrl);
          try {
            cleanPath = new URL(rawUrl, "http://localhost").pathname;
          } catch { /* ignore */ }

          const requestObj: RuntimeValue = [
            ["method", req.method || "GET"],
            ["path", cleanPath],
            ["query", queryPairs],
            ["body", body],
            ["headers", headerPairs],
          ];

          let responseValue: RuntimeValue;
          try {
            responseValue = caller(handler, [requestObj], line);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end(`Internal Server Error: ${msg}`);
            return;
          }

          let status = 200;
          let responseBody = "";
          const responseHeaders: Record<string, string> = {
            "Content-Type": "text/plain; charset=utf-8",
          };

          if (typeof responseValue === "string") {
            responseBody = responseValue;
          } else if (Array.isArray(responseValue)) {
            const s = pairGet(responseValue, "status");
            if (typeof s === "number") status = s;
            const b = pairGet(responseValue, "body");
            if (typeof b === "string") responseBody = b;
            else if (b !== null) responseBody = toText(b);
            const h = pairGet(responseValue, "headers");
            if (Array.isArray(h)) {
              const userHeaders = pairsToRecord(h);
              for (const [k, v] of Object.entries(userHeaders)) {
                responseHeaders[k] = v;
              }
            }
          } else if (responseValue === null) {
            responseBody = "";
          } else {
            responseBody = toText(responseValue);
          }

          res.writeHead(status, responseHeaders);
          res.end(responseBody);
        });
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          console.error(`Error: port ${port} is already in use.`);
          console.error(`       Try a different port: http.listen(${port + 1}, handle)`);
        } else {
          console.error(`Error: http server error: ${err.message}`);
        }
        process.exit(1);
      });

      server.listen(port, () => {
        console.log(`Breeze server listening on port ${port}`);
      });

      return null;
    }),

    makeBuiltin("get", (args, line) => {
      if (args.length < 1 || args.length > 2) {
        throw new BreezeError("http.get() needs a URL and an optional headers list", line);
      }
      const url = toText(args[0]);
      const headers = args.length === 2 ? pairsToRecord(args[1]) : {};
      return syncFetch(url, { method: "GET", headers }, line);
    }),

    makeBuiltin("post", (args, line) => {
      if (args.length < 2 || args.length > 3) {
        throw new BreezeError("http.post() needs a URL, a body, and an optional headers list", line);
      }
      const url = toText(args[0]);
      const body = toText(args[1]);
      const userHeaders = args.length === 3 ? pairsToRecord(args[2]) : {};
      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        ...userHeaders,
      };
      return syncFetch(url, { method: "POST", body, headers }, line);
    }),

    makeBuiltin("ok", (args, line) => {
      if (args.length !== 1) {
        throw new BreezeError("http.ok() needs 1 value (the response body)", line);
      }
      const body = typeof args[0] === "string" ? args[0] : toText(args[0]);
      return [
        ["status", 200],
        ["headers", [["Content-Type", "application/json; charset=utf-8"]]],
        ["body", body],
      ];
    }),

    makeBuiltin("error", (args, line) => {
      if (args.length !== 2) {
        throw new BreezeError("http.error() needs a status code and a message", line);
      }
      const status =
        typeof args[0] === "number" ? args[0] : parseInt(toText(args[0]), 10);
      if (isNaN(status) || status < 100 || status > 599) {
        throw new BreezeError(
          `http.error() status must be a valid HTTP status code, got: ${toText(args[0])}`,
          line
        );
      }
      const message = toText(args[1]);
      const body = JSON.stringify({ error: message });
      return [
        ["status", status],
        ["headers", [["Content-Type", "application/json; charset=utf-8"]]],
        ["body", body],
      ];
    }),
  ]);

  return { kind: "object", props };
}
