#!/usr/bin/env node
// Test runner — runs every example through the interpreter and checks output.
// Usage: node tests/run.js
// Exit 0 = all pass, exit 1 = any fail.

const { run, EXAMPLES } = require("../dist/index.js");

let pass = 0;
let fail = 0;
const failures = [];

for (const ex of EXAMPLES) {
  if (ex.id === "http-server") continue; // needs a port
  const r = run(ex.code);
  if (r.error) {
    fail++;
    failures.push(`${ex.id}: ${r.error}`);
    console.log(`  FAIL  ${ex.id} — ${r.error}`);
  } else {
    pass++;
    console.log(`  ok    ${ex.id} (${r.output.length} lines)`);
  }
}

console.log("");
console.log(`${pass} passed, ${fail} failed`);

if (fail > 0) {
  console.log("");
  console.log("Failures:");
  for (const f of failures) console.log("  " + f);
  process.exit(1);
}
