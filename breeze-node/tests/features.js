// Language feature tests — each checks a specific behavior.
// Run with: node tests/features.js
// Exit 0 = all pass, exit 1 = any fail.

const path = require("path");
const fs = require("fs");
const { run, runFile } = require("../dist/index.js");

// ─── helpers ─────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function check(name, code, expected, opts = {}) {
  const r = run(code, opts);
  if (opts.expectError) {
    if (r.error) {
      pass++;
      process.stdout.write(`  ok    ${name}\n`);
    } else {
      fail++;
      process.stdout.write(`  FAIL  ${name} — expected error but ran clean\n`);
      process.stdout.write(`        output: ${JSON.stringify(r.output)}\n`);
    }
    return;
  }
  if (r.error) {
    fail++;
    process.stdout.write(`  FAIL  ${name}\n`);
    process.stdout.write(`        error: ${r.error}\n`);
    return;
  }
  const exp = JSON.stringify(expected);
  const got = JSON.stringify(r.output);
  if (exp === got) {
    pass++;
    process.stdout.write(`  ok    ${name}\n`);
  } else {
    fail++;
    process.stdout.write(`  FAIL  ${name}\n`);
    process.stdout.write(`        expected: ${exp}\n`);
    process.stdout.write(`        got:      ${got}\n`);
  }
}

// Run a .bz source file from a temp path.
function checkFile(name, source, expected, opts = {}) {
  const tmp = path.join(__dirname, `_tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.bz`);
  fs.writeFileSync(tmp, source, "utf8");
  try {
    const r = runFile(tmp, opts);
    if (opts.expectError) {
      if (r.error) {
        pass++;
        process.stdout.write(`  ok    ${name}\n`);
      } else {
        fail++;
        process.stdout.write(`  FAIL  ${name} — expected error but ran clean\n`);
      }
      return;
    }
    if (r.error) {
      fail++;
      process.stdout.write(`  FAIL  ${name}\n`);
      process.stdout.write(`        error: ${r.error}\n`);
      return;
    }
    const exp = JSON.stringify(expected);
    const got = JSON.stringify(r.output);
    if (exp === got) {
      pass++;
      process.stdout.write(`  ok    ${name}\n`);
    } else {
      fail++;
      process.stdout.write(`  FAIL  ${name}\n`);
      process.stdout.write(`        expected: ${exp}\n`);
      process.stdout.write(`        got:      ${got}\n`);
    }
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  }
}

// ─── core language ────────────────────────────────────────────────────────────

process.stdout.write("\nCore language\n");

check("variable assignment and show",
  'x = 42\nshow x',
  ["42"]);

check("string concatenation with +",
  'show "hello" + " " + "world"',
  ["hello world"]);

check("auto-join number and text",
  'show "Age: " + 25',
  ["Age: 25"]);

check("string interpolation — literal",
  'name = "World"\nshow "Hello, {name}!"',
  ["Hello, World!"]);

check("string interpolation — expression inside braces",
  'show "1+2 = {1+2}"',
  ["1+2 = 3"]);

check("nested interpolation expression",
  'x = 4\nshow "double: {x * 2}"',
  ["double: 8"]);

check("arithmetic — all operators",
  'show 10 + 3\nshow 10 - 3\nshow 10 * 3\nshow 10 / 4\nshow 10 % 3',
  ["13", "7", "30", "2.5", "1"]);

check("division by zero raises error",
  'show 5 / 0',
  [], { expectError: true });

check("mod by zero raises error",
  'show 5 % 0',
  [], { expectError: true });

check("boolean literals",
  'show true\nshow false',
  ["true", "false"]);

check("none literal",
  'show none',
  ["none"]);

check("comparison operators",
  'show 1 < 2\nshow 2 > 1\nshow 1 <= 1\nshow 2 >= 3\nshow 1 == 1\nshow 1 != 2',
  ["true", "true", "true", "false", "true", "true"]);

check("logical and / or / not",
  'show true and false\nshow true or false\nshow not true',
  ["false", "true", "false"]);

check("list literal and indexing",
  'items = [10, 20, 30]\nshow items[0]\nshow items[2]',
  ["10", "30"]);

check("negative list index",
  'items = [1, 2, 3]\nshow items[-1]',
  ["3"]);

check("list index out of range raises error",
  'items = [1]\nshow items[5]',
  [], { expectError: true });

check("list mutation via index assignment",
  'items = [1, 2, 3]\nitems[1] = 99\nshow items[1]',
  ["99"]);

// ─── control flow ─────────────────────────────────────────────────────────────

process.stdout.write("\nControl flow\n");

check("if / elif / else",
  'x = 75\nif x > 90:\n  show "A"\nelif x > 70:\n  show "C"\nelse:\n  show "F"',
  ["C"]);

check("if with false condition falls through to else",
  'if false:\n  show "no"\nelse:\n  show "yes"',
  ["yes"]);

check("while loop",
  'n = 3\nwhile n > 0:\n  show n\n  n = n - 1',
  ["3", "2", "1"]);

check("repeat N times",
  'repeat 3:\n  show "hi"',
  ["hi", "hi", "hi"]);

check("repeat 0 times does nothing",
  'repeat 0:\n  show "nope"',
  []);

check("repeat i from a to b",
  'repeat i from 1 to 3:\n  show i',
  ["1", "2", "3"]);

check("for x in list",
  'for x in [10, 20, 30]:\n  show x',
  ["10", "20", "30"]);

check("for over empty list",
  'for x in []:\n  show "should not run"',
  []);

check("break exits loop early",
  'repeat i from 1 to 100:\n  if i > 3:\n    break\n  show i',
  ["1", "2", "3"]);

check("continue skips current iteration",
  'repeat i from 1 to 5:\n  if i % 2 == 0:\n    continue\n  show i',
  ["1", "3", "5"]);

// ─── functions ────────────────────────────────────────────────────────────────

process.stdout.write("\nFunctions\n");

check("basic function and return",
  'func add(a, b):\n  return a + b\nshow add(3, 4)',
  ["7"]);

check("recursive fibonacci",
  'func fib(n):\n  if n < 2:\n    return n\n  return fib(n-1) + fib(n-2)\nshow fib(10)',
  ["55"]);

check("forward reference — function used before its definition in source",
  'show double(5)\nfunc double(x):\n  return x * 2',
  ["10"]);

check("closure captures mutable state",
  'func counter():\n  n = 0\n  func inc():\n    n = n + 1\n    return n\n  return inc\nc = counter()\nshow c()\nshow c()\nshow c()',
  ["1", "2", "3"]);

check("anonymous function assigned to variable",
  'double = func(x): return x * 2\nshow double(7)',
  ["14"]);

check("wrong arg count raises error",
  'func f(a, b): return a + b\nf(1)',
  [], { expectError: true });

check("return with no value returns none",
  'func f(): return\nshow f()',
  ["none"]);

// ─── try / catch ──────────────────────────────────────────────────────────────

process.stdout.write("\nError handling\n");

check("try/catch catches division by zero",
  'try:\n  show 1 / 0\ncatch e:\n  show "caught: " + e',
  ["caught: Cannot divide by zero"]);

check("try/catch catches undefined variable",
  'try:\n  show missing\ncatch err:\n  show "got: " + err',
  ["got: Name 'missing' is not defined"]);

check("try without error runs the body normally",
  'try:\n  show "ok"\ncatch e:\n  show "should not print"',
  ["ok"]);

check("try/catch catches wrong argument count",
  'func f(a): return a\ntry:\n  f(1, 2)\ncatch e:\n  show "caught"',
  ["caught"]);

// ─── builtins ─────────────────────────────────────────────────────────────────

process.stdout.write("\nBuiltin functions\n");

check("len() on string",
  'show len("hello")',
  ["5"]);

check("len() on list",
  'show len([1, 2, 3])',
  ["3"]);

check("upper() / lower()",
  'show upper("hello")\nshow lower("WORLD")',
  ["HELLO", "world"]);

check("trim()",
  'show trim("  hi  ")',
  ["hi"]);

check("split() and join()",
  'parts = split("a,b,c", ",")\nshow join(parts, "-")',
  ["a-b-c"]);

check("contains() on string",
  'show contains("foobar", "bar")',
  ["true"]);

check("contains() on list",
  'show contains([1, 2, 3], 2)',
  ["true"]);

check("starts_with() / ends_with()",
  'show starts_with("hello", "he")\nshow ends_with("hello", "lo")',
  ["true", "true"]);

check("replace()",
  'show replace("hello world", "world", "Breeze")',
  ["hello Breeze"]);

check("slice()",
  'show slice("abcdef", 2, 4)',
  ["cd"]);

check("index_of() on string",
  'show index_of("hello", "ll")',
  ["2"]);

check("reverse() on list",
  'show reverse([1, 2, 3])',
  ["[3, 2, 1]"]);

check("push() mutates list",
  'items = [1, 2]\npush(items, 3)\nshow items',
  ["[1, 2, 3]"]);

check("range() single arg",
  'show range(3)',
  ["[0, 1, 2]"]);

check("range() two args",
  'show range(2, 5)',
  ["[2, 3, 4]"]);

check("sum()",
  'show sum([1, 2, 3, 4])',
  ["10"]);

check("min() / max() global builtins",
  'show min(3, 1, 2)\nshow max(3, 1, 2)',
  ["1", "3"]);

check("abs() / round() / floor() / ceil()",
  'show abs(-5)\nshow round(2.7)\nshow floor(2.9)\nshow ceil(2.1)',
  ["5", "3", "2", "3"]);

check("type()",
  'show type(42)\nshow type("hi")\nshow type(true)\nshow type(none)\nshow type([1])',
  ["number", "string", "boolean", "none", "list"]);

check("number() converts string to number",
  'show number("3.14")',
  ["3.14"]);

check("text() converts number to string",
  'show text(42)',
  ["42"]);

// ─── stdlib: json ─────────────────────────────────────────────────────────────

process.stdout.write("\nStdlib: json\n");

check("json.parse and json.get",
  'obj = json.parse(\'{"name":"Alice","age":30}\')\nshow json.get(obj, "name")\nshow json.get(obj, "age")',
  ["Alice", "30"]);

check("json.stringify round-trips a list-of-pairs",
  'obj = [["x", 1], ["y", 2]]\nshow json.stringify(obj)',
  ['{"x":1,"y":2}']);

check("json.set updates existing key",
  'obj = json.parse(\'{"a":1}\')\njson.set(obj, "a", 99)\nshow json.get(obj, "a")',
  ["99"]);

check("json.set adds new key",
  'obj = json.parse(\'{"a":1}\')\njson.set(obj, "b", 2)\nshow json.get(obj, "b")',
  ["2"]);

check("json.has returns true/false",
  'obj = json.parse(\'{"x":1}\')\nshow json.has(obj, "x")\nshow json.has(obj, "z")',
  ["true", "false"]);

check("json.keys returns all keys",
  'obj = [["a", 1], ["b", 2]]\nshow join(json.keys(obj), ",")',
  ["a,b"]);

check("json.get missing key returns none",
  'obj = json.parse(\'{}\')\nshow json.get(obj, "missing")',
  ["none"]);

check("json.parse invalid text raises error",
  'json.parse("not json")',
  [], { expectError: true });

// ─── stdlib: math ─────────────────────────────────────────────────────────────

process.stdout.write("\nStdlib: math\n");

check("math.sqrt",
  'show math.sqrt(9)',
  ["3"]);

check("math.pow",
  'show math.pow(2, 10)',
  ["1024"]);

check("math.pi constant",
  'show math.pi > 3.14 and math.pi < 3.15',
  ["true"]);

check("math.min / math.max",
  'show math.min(5, 2, 8)\nshow math.max(5, 2, 8)',
  ["2", "8"]);

check("math.log and math.exp are inverses",
  'x = 5\nshow round(math.exp(math.log(x))) == x',
  ["true"]);

// ─── stdlib: env ──────────────────────────────────────────────────────────────

process.stdout.write("\nStdlib: env\n");

check("env.set and env.get round-trip",
  'env.set("BREEZE_TEST_VAR", "hello123")\nshow env.get("BREEZE_TEST_VAR")',
  ["hello123"]);

check("env.get missing key returns none",
  'show env.get("BREEZE_NO_SUCH_VAR_XYZ")',
  ["none"]);

// ─── stdlib: fs ───────────────────────────────────────────────────────────────

process.stdout.write("\nStdlib: fs\n");

{
  const tmpDir = path.join(__dirname, "_tmp_fs_test_" + Date.now());
  const tmpFile = path.join(tmpDir, "test.txt");

  check("fs.write + fs.read + fs.exists + fs.remove", (() => {
    // Build a code string that uses the real paths.
    return (
      `fs.mkdir("${tmpDir.replace(/\\/g, "\\\\")}")\n` +
      `fs.write("${tmpFile.replace(/\\/g, "\\\\")}", "breeze test")\n` +
      `show fs.exists("${tmpFile.replace(/\\/g, "\\\\")}")\n` +
      `show fs.read("${tmpFile.replace(/\\/g, "\\\\")}")\n` +
      `fs.remove("${tmpDir.replace(/\\/g, "\\\\")}")\n` +
      `show fs.exists("${tmpDir.replace(/\\/g, "\\\\")}")`
    );
  })(), ["true", "breeze test", "false"]);
}

check("fs.remove on non-existent path raises error",
  'fs.remove("/this/path/definitely/does/not/exist/xyz123")',
  [], { expectError: true });

check("fs.read non-existent file raises error",
  'fs.read("/this/file/does/not/exist/xyz.bz")',
  [], { expectError: true });

// ─── modules / import-export ──────────────────────────────────────────────────

process.stdout.write("\nModules: import / export\n");

{
  const modDir = path.join(__dirname, "_tmp_mod_" + Date.now());
  fs.mkdirSync(modDir, { recursive: true });

  // Write a module that exports a function and a value.
  const utilSrc = `
export func double(x):
  return x * 2

export greeting = "hello from util"
`;
  fs.writeFileSync(path.join(modDir, "util.bz"), utilSrc, "utf8");

  // Write the main file into the same dir so relative imports resolve correctly.
  const mainSrc = `
import { double, greeting } from "./util.bz"
show double(7)
show greeting
`;
  const mainPath = path.join(modDir, "main.bz");
  fs.writeFileSync(mainPath, mainSrc, "utf8");
  {
    const r = runFile(mainPath);
    const exp = JSON.stringify(["14", "hello from util"]);
    const got = JSON.stringify(r.output);
    if (r.error) {
      fail++; process.stdout.write(`  FAIL  import function and value from another module\n        error: ${r.error}\n`);
    } else if (exp === got) {
      pass++; process.stdout.write(`  ok    import function and value from another module\n`);
    } else {
      fail++; process.stdout.write(`  FAIL  import function and value from another module\n        expected: ${exp}\n        got: ${got}\n`);
    }
  }

  // Chain: A imports B imports C.
  fs.writeFileSync(path.join(modDir, "c.bz"), `export val = 42\n`, "utf8");
  fs.writeFileSync(path.join(modDir, "b.bz"), `import { val } from "./c.bz"\nexport doubled = val * 2\n`, "utf8");
  const chainPath = path.join(modDir, "chain_main.bz");
  fs.writeFileSync(chainPath, `import { doubled } from "./b.bz"\nshow doubled`, "utf8");
  {
    const r = runFile(chainPath);
    const exp = JSON.stringify(["84"]);
    const got = JSON.stringify(r.output);
    if (r.error) {
      fail++; process.stdout.write(`  FAIL  chained module imports (A→B→C)\n        error: ${r.error}\n`);
    } else if (exp === got) {
      pass++; process.stdout.write(`  ok    chained module imports (A→B→C)\n`);
    } else {
      fail++; process.stdout.write(`  FAIL  chained module imports (A→B→C)\n        expected: ${exp}\n        got: ${got}\n`);
    }
  }

  // A module is only executed once even when imported multiple times.
  fs.writeFileSync(path.join(modDir, "once.bz"), `export x = 1\n`, "utf8");
  const oncePath = path.join(modDir, "once_main.bz");
  fs.writeFileSync(oncePath, `import { x } from "./once.bz"\nimport { x } from "./once.bz"\nshow x`, "utf8");
  {
    const r = runFile(oncePath);
    const exp = JSON.stringify(["1"]);
    const got = JSON.stringify(r.output);
    if (r.error) {
      fail++; process.stdout.write(`  FAIL  module is cached and not re-executed on second import\n        error: ${r.error}\n`);
    } else if (exp === got) {
      pass++; process.stdout.write(`  ok    module is cached and not re-executed on second import\n`);
    } else {
      fail++; process.stdout.write(`  FAIL  module is cached and not re-executed on second import\n        expected: ${exp}\n        got: ${got}\n`);
    }
  }

  // Clean up.
  try { fs.rmSync(modDir, { recursive: true, force: true }); } catch { /* best effort */ }
}


// ─── sandbox mode ─────────────────────────────────────────────────────────────

process.stdout.write("\nSandbox mode\n");

check("sandbox blocks fs.read",
  'show fs.read("/etc/hostname")',
  [], { sandbox: true, expectError: true });

check("sandbox blocks fs.write",
  'fs.write("/tmp/x", "hello")',
  [], { sandbox: true, expectError: true });

check("sandbox blocks env.get",
  'show env.get("HOME")',
  [], { sandbox: true, expectError: true });

check("sandbox blocks python.run",
  'show python.run("print(1)")',
  [], { sandbox: true, expectError: true });

check("sandbox allows math and json (non-IO builtins)",
  'show math.sqrt(16)\nshow json.stringify([["ok", true]])',
  ["4", '{"ok":true}'],
  { sandbox: true });

// ─── edge cases ───────────────────────────────────────────────────────────────

process.stdout.write("\nEdge cases\n");

check("deep recursion hits depth guard cleanly",
  'func inf(n): return inf(n + 1)\ntry:\n  inf(0)\ncatch e:\n  show "depth exceeded"',
  ["depth exceeded"]);

// The step guard fires and produces a clear error (not a JS crash).
// Note: the BreezeError from the step guard propagates to run() rather than
// being catchable by a Breeze try/catch inside the same loop — this is a known
// interpreter limitation. The important thing is it doesn't hang or crash.
check("step guard fires with a clear error message",
  'while true:\n  x = 1',
  [], { expectError: true });

check("undefined variable raises a clear error",
  'show undefined_variable_xyz',
  [], { expectError: true });

check("calling a non-function raises error",
  'x = 5\nx()',
  [], { expectError: true });

check("wrong arg count to builtin raises error",
  'len()',
  [], { expectError: true });

check("repeat with negative count raises error",
  'repeat -1:\n  show "no"',
  [], { expectError: true });

check("for loop over a non-list raises error",
  'for x in 42:\n  show x',
  [], { expectError: true });

check("multi-line expressions in parentheses",
  'result = (\n  1 +\n  2 +\n  3\n)\nshow result',
  ["6"]);

check("single-quoted strings are not interpolated",
  "x = 42\nshow '{x}'",
  ["{x}"]);

check("escape sequences in double-quoted strings",
  'show "line1\\nline2"',
  ["line1\nline2"]);

check("show multiple args comma-separated",
  'show "a", "b", "c"',
  ["a b c"]);

// ─── summary ──────────────────────────────────────────────────────────────────

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
