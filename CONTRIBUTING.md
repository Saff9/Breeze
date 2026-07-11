# Contributing to Breeze

Thanks for being here. Breeze is a small project and most of it is easy to
hold in your head — which makes it a good place to land a first patch.

## Ways to help

- **Report bugs.** Open an issue with the Breeze code, what you expected, and
  what you got. Include the version (`breeze version`).
- **Add an example.** If you built something cool, drop it in `examples/`.
- **Add a stdlib function.** Pick a missing one — `math.log10`, `text.title`,
  `list.sort` — and wire it in. It's about 10 lines.
- **Improve an interpreter.** The Rust and Node versions should stay in sync.
  If you fix a bug in one, port it to the other.
- **Write docs.** If something confused you, fix the docs so it doesn't
  confuse the next person.

## Getting set up

You need Node 18+ and (optionally) Rust 1.70+.

```bash
git clone https://github.com/Saff9/Breeze.git
cd breeze
make setup        # installs deps for all packages
make build        # builds everything
make test         # runs the example programs through both interpreters
```

If you only want to work on one runtime, you can skip the others:

```bash
cd breeze-node && npm install && npx tsc        # Node only
cd breeze-rs && cargo build                     # Rust only
cd breeze-vscode && npm install && npx tsc      # VS Code only
```

## Code style

**Rust.** Safe only — no `unsafe`. Zero external deps. Run `cargo fmt` and
`cargo clippy -- -D warnings` before pushing.

**TypeScript.** Strict mode. Comments should explain *why*, not *what*. If
the code reads clearly, don't add a comment.

**Across both.** Keep the two interpreters in sync on language features. The
browser runtime (`breeze-browser/breeze.js`) is hand-maintained — update it
when you add a core feature.

## Adding a stdlib function

Pick a package. Here's `math.log10` in the Node runtime:

1. Open `breeze-node/src/stdlib/math.ts`.
2. Add it alongside the others:

```typescript
makeBuiltin("log10", (args, line) => {
  checkArgCount("log10", args, 1, line);
  return Math.log10(toNumber(args[0], line));
}),
```

3. Rebuild and test:

```bash
npx tsc && node dist/cli.js eval 'show math.log10(1000)'
```

4. Port it to `breeze-rs/src/interpreter.rs` (find `install_builtins`, add
   the matching `bind!` line).
5. Add an example if it's interesting.

## Adding an example

Create a folder under `examples/` with a `main.bz` and a short `README.md`.
Run it through both interpreters to make sure it works:

```bash
node breeze-node/dist/cli.js run examples/my-thing/main.bz
./breeze-rs/target/debug/breeze examples/my-thing/main.bz
```

## Sending a pull request

- Branch off `main`.
- One logical change per PR.
- Write a clear commit message. `Add math.log10` is good. `update` is not.
- If you changed language behavior, mention it in the PR and update the spec
  in `docs/LANGUAGE_SPEC.md`.

## Reporting issues

Use the issue templates. The more reproducible your bug, the faster it gets
fixed. A 5-line Breeze program that triggers the bug is ideal.

## Conduct

Be kind. This is a beginner-focused project — a lot of people here are
writing their first patch. Assume good faith, answer questions patiently,
and remember we were all new once.
