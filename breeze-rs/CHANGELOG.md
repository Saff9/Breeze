# Changelog

All notable changes to the Breeze programming language are documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-10

First public release of Breeze — a beginner-friendly, indentation-based
programming language implemented entirely in safe Rust with zero external
dependencies.

### Added

- **Complete lexer** with Python-style indentation handling that emits
  explicit `INDENT` and `DEDENT` tokens, so block structure is determined by
  whitespace alone — no braces, no semicolons.
- **Recursive-descent parser** that produces a typed, heap-allocated AST with
  clear error messages pointing at the offending source line.
- **Tree-walking interpreter** with lexical scoping, first-class closures,
  and automatic text/number coercion for the `+` operator (e.g.
  `"Score: " + 95` just works — no `str()` needed).
- **17 built-in functions** available in every Breeze program without any
  import:
  `text`, `number`, `len`, `upper`, `lower`, `abs`, `round`, `floor`, `ceil`,
  `random`, `sum`, `min`, `max`, `push`, `range`, `type`, `join`.
- **Interactive REPL** with multi-line block support — incomplete blocks are
  detected automatically and the prompt continues on the next line.
- **Command-line interface** with two execution modes:
  - `breeze file.bz` — run a Breeze program from disk.
  - `breeze -e 'show "hi"'` — evaluate a one-liner inline.
- **9 example programs** shipping in the `examples/` directory, each doubles
  as a self-contained tutorial: `hello`, `variables`, `conditions`, `loops`,
  `functions`, `lists`, `fizzbuzz`, `strings`, `recursion`.
- **Infinite-loop protection** — every program is capped at 2,000,000
  interpreter steps and raises a friendly timeout error instead of hanging.
- **100% safe Rust** — the entire codebase compiles with `#![forbid(unsafe_code)]`
  in mind; there is no `unsafe` block anywhere in the interpreter.
- **Zero external dependencies** — the `Cargo.toml` dependency list is empty,
  keeping the resulting binary small and the build reproducible.

### Security

Breeze programs run inside a sandboxed interpreter with no access to the host
system. Concretely, there is **no** built-in mechanism for:

- Filesystem access (no `open`, `read`, `write`, or `delete`).
- Network access (no sockets, HTTP, or DNS).
- Process spawning (no `exec`, `system`, or shell escapes).
- Foreign-function interface (no `ffi`, no `dlopen`).

The only side effects a Breeze program can produce are writing to its own
standard output (via `show`) and producing an exit code. This makes Breeze
safe to embed in playgrounds, grading systems, and other contexts where
untrusted code must be evaluated.

[1.0.0]: https://github.com/Saff9/Breeze/releases/tag/v1.0.0
