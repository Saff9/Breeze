// html stdlib: escape, tag, page, div, p, h1, h2, h3, link, ul, ol, img.
// Content is NOT escaped — wrap nested html.* output; call escape() on user text.

import {
  ObjectValue,
  RuntimeValue,
  BuiltinFunction,
  BreezeError,
} from "../types";

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

// & must be escaped first so we don't re-escape the entities we just inserted.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// attrs is a list of [key, value] pairs; both are escaped to prevent attribute breakout.
function renderAttrs(attrs: RuntimeValue): string {
  if (!Array.isArray(attrs)) return "";
  let out = "";
  for (const pair of attrs) {
    if (Array.isArray(pair) && pair.length === 2) {
      const k = escapeHtml(toText(pair[0]));
      const v = escapeHtml(toText(pair[1]));
      out += ` ${k}="${v}"`;
    }
  }
  return out;
}

export function createHtmlObject(): ObjectValue {
  const props = new Map<string, RuntimeValue>([
    makeBuiltin("escape", (args, line) => {
      if (args.length !== 1) {
        throw new BreezeError("html.escape() needs 1 text value", line);
      }
      return escapeHtml(toText(args[0]));
    }),
    makeBuiltin("tag", (args, line) => {
      if (args.length < 2 || args.length > 3) {
        throw new BreezeError(
          "html.tag() needs 2 or 3 values: (name, content) or (name, content, attrs)",
          line
        );
      }
      const name = toText(args[0]);
      const content = toText(args[1]);
      const attrs = args.length === 3 ? renderAttrs(args[2]) : "";
      return `<${name}${attrs}>${content}</${name}>`;
    }),
    makeBuiltin("page", (args, line) => {
      if (args.length !== 2) {
        throw new BreezeError(
          "html.page() needs a title and a body",
          line
        );
      }
      const title = escapeHtml(toText(args[0]));
      const body = toText(args[1]);
      return (
        "<!DOCTYPE html><html><head><title>" +
        title +
        "</title></head><body>" +
        body +
        "</body></html>"
      );
    }),
    makeBuiltin("div", (args, line) => {
      if (args.length !== 1) throw new BreezeError("html.div() needs 1 content value", line);
      return "<div>" + toText(args[0]) + "</div>";
    }),
    makeBuiltin("p", (args, line) => {
      if (args.length !== 1) throw new BreezeError("html.p() needs 1 content value", line);
      return "<p>" + toText(args[0]) + "</p>";
    }),
    makeBuiltin("h1", (args, line) => {
      if (args.length !== 1) throw new BreezeError("html.h1() needs 1 content value", line);
      return "<h1>" + toText(args[0]) + "</h1>";
    }),
    makeBuiltin("h2", (args, line) => {
      if (args.length !== 1) throw new BreezeError("html.h2() needs 1 content value", line);
      return "<h2>" + toText(args[0]) + "</h2>";
    }),
    makeBuiltin("h3", (args, line) => {
      if (args.length !== 1) throw new BreezeError("html.h3() needs 1 content value", line);
      return "<h3>" + toText(args[0]) + "</h3>";
    }),
    makeBuiltin("link", (args, line) => {
      if (args.length !== 2) {
        throw new BreezeError(
          "html.link() needs a URL and link text",
          line
        );
      }
      const url = escapeHtml(toText(args[0]));
      const text = escapeHtml(toText(args[1]));
      return `<a href="${url}">${text}</a>`;
    }),
    makeBuiltin("ul", (args, line) => {
      if (args.length !== 1) {
        throw new BreezeError("html.ul() needs 1 list of items", line);
      }
      if (!Array.isArray(args[0])) {
        throw new BreezeError("html.ul() needs a list of items", line);
      }
      const items = args[0] as RuntimeValue[];
      const lis = items
        .map((item) => "<li>" + escapeHtml(toText(item)) + "</li>")
        .join("");
      return "<ul>" + lis + "</ul>";
    }),
    makeBuiltin("ol", (args, line) => {
      if (args.length !== 1) {
        throw new BreezeError("html.ol() needs 1 list of items", line);
      }
      if (!Array.isArray(args[0])) {
        throw new BreezeError("html.ol() needs a list of items", line);
      }
      const items = args[0] as RuntimeValue[];
      const lis = items
        .map((item) => "<li>" + escapeHtml(toText(item)) + "</li>")
        .join("");
      return "<ol>" + lis + "</ol>";
    }),
    makeBuiltin("img", (args, line) => {
      if (args.length !== 2) {
        throw new BreezeError(
          "html.img() needs a src URL and alt text",
          line
        );
      }
      const src = escapeHtml(toText(args[0]));
      const alt = escapeHtml(toText(args[1]));
      return `<img src="${src}" alt="${alt}">`;
    }),
  ]);

  return { kind: "object", props };
}
