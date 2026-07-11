#!/usr/bin/env node
"use strict";
// Breeze CLI entry.
// If V8's default stack is too small for deep recursion, relaunch with a
// larger stack. This lets `breeze run` handle ~1000+ frames of recursion
// without the user needing to pass --stack-size manually.
try {
  require("../dist/cli.js");
} catch (e) {
  // RangeError from stack overflow — relaunch with a bigger stack.
  if (e instanceof RangeError && /stack/i.test(e.message)) {
    const { execFileSync } = require("child_process");
    const args = ["--stack-size=4096", require.resolve("../dist/cli.js"), ...process.argv.slice(2)];
    try {
      execFileSync(process.execPath, args, { stdio: "inherit" });
    } catch (e2) {
      process.exit(e2.status || 1);
    }
  } else {
    process.stderr.write(String(e) + "\n");
    process.exit(1);
  }
}
