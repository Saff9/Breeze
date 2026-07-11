# Contributing to Breeze

First of all — thank you for being here! Breeze exists to make programming
gentle on beginners, and that same spirit guides how we work together on the
project. Whether you are filing your first ever bug report, fixing a typo in
the docs, or adding a brand-new language feature, you are welcome here. This
document explains how to get the project building locally, how the codebase is
laid out, and what a good contribution looks like.

If anything below is unclear, please open an issue labelled `question` — we
treat documentation gaps as bugs.

---

## Code of Conduct

Breeze is, above all, a **beginner-focused** language. Many of the people
using it — and many of the people who will read your issue, review your pull
request, or pair with you on a fix — are writing code for the first time.
Keep that front of mind:

- **Be welcoming.** Assume good faith. Assume the person on the other end may
  be a day-one beginner, in Breeze *or* in Rust.
- **Be patient.** A question that looks "obvious" to you may be the result of
  someone bravely asking for help for the first time. Answer it the way you
  would have wanted to be answered when you were starting out.
- **Be kind about mistakes.** First pull requests often have style nits,
  missed tests, or formatting issues. Point them out constructively; never
  dismissive.
- **Be respectful.** No harassment, discrimination, or personal attacks. This
  covers (but isn't limited to) gender, sexual orientation, disability,
  ethnicity, religion, age, nationality, or experience level.
- **Assume good intent, but be responsible for your impact.** If someone lets
  you know that something you said landed poorly, take it on board without
  getting defensive.

We will keep this community the friendliest place on the internet to learn
programming. Thank you for helping us do that.

---

## Getting Started

You'll need a recent Rust toolchain. The project targets **Rust 1.70 or
newer** and uses the 2021 edition.

1. **Clone the repository**

   ```bash
   git clone https://github.com/Saff9/Breeze.git
   cd breeze
   ```

2. **Install Rust 1.70+**

   The easiest way is with [rustup](https://rustup.rs/):

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup default stable
   ```

   Verify your version:

   ```bash
   rustc --version   # should print 1.70.0 or higher
   ```

3. **Build the project**

   ```bash
   cargo build
   ```

   This compiles the `breeze` binary (the CLI and REPL) and the `breeze`
   library crate. The first build is fast because there are **no external
   dependencies** to download.

4. **Verify it runs**

   ```bash
   cargo run -- examples/hello.bz
   # → Hello, World!

   cargo run -- -e 'show 2 + 2'
   # → 4
   ```

5. **Verify the release build**

   > **Note:** Breeze does **not** ship a unit-test suite yet. For now, the
   > canonical way to verify your changes is to ensure the project compiles
   > cleanly in release mode and that the example programs still run as
   > expected:

   ```bash
   cargo build --release
   for f in examples/*.bz; do
     echo "=== $f ==="
     ./target/release/breeze "$f"
   done
   ```

   If all nine examples produce their expected output, you are good to go.

---

## Project Structure

The interpreter is intentionally compact — a single crate, no sub-crates, no
dependencies. Every module has one clear job:

```
breeze-rs/
├── src/
│   ├── lexer.rs        # Tokenizer. Converts source text into a flat token
│   │                    #   stream, emitting INDENT/DEDENT tokens so the
│   │                    #   parser never has to look at whitespace.
│   ├── parser.rs       # Recursive-descent parser. Consumes the token stream
│   │                    #   and produces a typed AST.
│   ├── ast.rs          # AST node definitions and the Token / TokenKind
│   │                    #   types shared by the lexer and parser.
│   ├── value.rs        # Runtime value helpers: Value enum, conversions,
│   │                    #   and the to_number / value_to_string utilities.
│   ├── interpreter.rs  # The tree-walking evaluator. Holds the environment,
│   │                    #   resolves scopes/closures, and installs all the
│   │                    #   built-in functions.
│   ├── error.rs        # BreezeError type and formatting.
│   ├── main.rs         # CLI entry point: parses argv, dispatches to file
│   │                    #   mode, -e mode, or the REPL.
│   └── lib.rs          # Library API. Re-exports the public types so Breeze
│                        #   can be embedded as a crate.
├── examples/           # .bz example programs — each one a tiny tutorial.
└── Cargo.toml
```

If you are adding a new language feature, you will usually touch four files:
`ast.rs` (new node), `parser.rs` (parse it), `interpreter.rs` (evaluate it),
and an `examples/*.bz` program (demonstrate it).

---

## Coding Standards

These rules exist to keep Breeze small, safe, and friendly to read — please
follow them on every contribution.

- **100% safe Rust only.** No `unsafe` blocks, anywhere. The "no unsafe"
  guarantee is part of Breeze's public identity and a security property we
  promise to users embedding the interpreter.
- **Zero external dependencies preferred.** The `Cargo.toml` `[dependencies]`
  section is intentionally empty, which keeps the binary tiny and the build
  hermetic. If your change *requires* a crate, please open an issue first so
  we can discuss whether the feature is worth the dependency.
- **Document all public items.** Every `pub` item should carry a `///`
  rustdoc comment explaining what it does. For non-obvious private items, a
  short `//` comment is appreciated.
- **Run the formatter and linter before submitting.**

  ```bash
  cargo fmt
  cargo clippy --all-targets -- -D warnings
  ```

  Clippy warnings must be cleaned up; warnings in CI will block a merge.
- **Match the existing code style.**
  - 4-space indentation.
  - `snake_case` for functions, methods, variables, and modules.
  - `UpperCamelCase` for types and enum variants.
  - Line length is not strictly enforced, but try to keep lines readable
    (≈100 columns is a good target).
- **Keep the example programs runnable.** If you change the language in a way
  that breaks an `examples/*.bz` file, update the example too — it is part of
  the contract.

---

## Adding a Built-in Function

One of the most common — and most beginner-friendly — contributions is adding
a new built-in function. As a concrete walkthrough, here is how you would add
`repeat_text(s, n)`, which repeats the text `s` exactly `n` times.

### 1. Write the function in `src/interpreter.rs`

Built-ins share a single signature:

```rust
fn builtin_repeat_text(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("repeat_text", args, 2, line)?;
    let s = match &args[0] {
        Value::Text(s) => s.clone(),
        _ => {
            return Err(BreezeError::new(
                "repeat_text() needs text as the first value",
                line,
            ));
        }
    };
    let n = to_number(&args[1], line)?;
    if n < 0.0 {
        return Err(BreezeError::new(
            "repeat_text() needs a non-negative count",
            line,
        ));
    }
    Ok(Value::Text(s.repeat(n as usize)))
}
```

A few conventions to notice:

- Use `need_args(name, args, n, line)?` to validate the argument count — it
  raises the standard "needs N values but got M" error.
- Use the existing `to_number` / `value_to_string` helpers for coercions so
  the `+`-style auto-coercion behaviour stays consistent across built-ins.
- Return a friendly, beginner-readable `BreezeError` for misuse. Always
  include the originating `line` so the user sees where they went wrong.
- Return `Value::Text`, `Value::Number`, `Value::List`, `Value::Bool`,
  `Value::None`, or a closure/function value as appropriate.

### 2. Bind it in `install_builtins`

Just inside `install_builtins`, alongside the existing `bind!` calls:

```rust
fn install_builtins(env: &mut Environment) {
    macro_rules! bind {
        ($env:expr, $name:expr, $f:expr) => {
            $env.set(
                $name.to_string(),
                Value::Builtin {
                    name: $name.to_string(),
                    f: $f,
                },
            );
        };
    }

    bind!(env, "text", builtin_text);
    bind!(env, "number", builtin_number);
    // ... existing bindings ...
    bind!(env, "join", builtin_join);
    bind!(env, "repeat_text", builtin_repeat_text);   // <-- new
}
```

The `bind!` macro handles wrapping your function pointer in a
`Value::Builtin` and inserting it into the global environment.

### 3. Add an example program

Create `examples/repeat_text.bz`:

```breeze
# repeat_text(s, n) — repeat a piece of text n times
show repeat_text("ha", 3)
show repeat_text("-", 10)
show repeat_text("ab", 0)
```

Verify it:

```bash
cargo run -- examples/repeat_text.bz
# → hahaha
# → ----------
# → (empty line, which is correct for n=0)
```

### 4. Document it

- Add a row to the built-in functions table in `README.md`.
- Mention the new function in `CHANGELOG.md` under an `### Added` heading
  for the next release.

That's the whole process. The same pattern — implement, bind, example,
document — applies to every built-in addition.

---

## Submitting Changes

1. **Fork** the repository and create a feature branch from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

   Use a descriptive branch name. Good prefixes: `feat-`, `fix-`, `docs-`,
   `refactor-`, `chore-`.

2. **Make your changes** following the coding standards above.

3. **Verify locally.**

   ```bash
   cargo fmt
   cargo clippy --all-targets -- -D warnings
   cargo build --release
   for f in examples/*.bz; do ./target/release/breeze "$f"; done
   ```

4. **Commit with conventional commit messages.** The project uses
   [Conventional Commits](https://www.conventionalcommits.org/):

   ```
   feat: add repeat_text built-in
   fix: correct off-by-one in range() end bound
   docs: clarify indentation rules in README
   refactor: extract need_args helper in interpreter
   test: (reserved — no test suite yet)
   chore: bump Rust edition in CI
   ```

   Keep the subject line under 72 characters. Add a body paragraph if the
   "why" is not obvious from the title.

5. **Open a pull request** against `main`. In the PR description, include:

   - A short summary of what changed and why.
   - The list of example programs you ran to verify (paste their output if
     relevant).
   - Any open questions or follow-ups.

6. **Respond to review feedback.** Reviews are collaborative — reviewers may
   suggest style changes, ask for an example, or propose a different
   approach. Discussion is welcome; please just keep it kind (see the Code of
   Conduct above).

---

## Reporting Issues

Found a bug? Got an idea? Please open an issue — we read every one of them.

### Bug reports

A useful bug report includes:

1. **The Breeze version** you are running.

   ```bash
   breeze --version
   # or, if building from source:
   git rev-parse --short HEAD
   ```

2. **The Breeze code that triggered it.** A minimal, copy-pasteable snippet is
   ideal. If the bug only shows up inside a larger program, try to shrink it
   down to the smallest program that still reproduces the issue.

3. **The expected output vs. the actual output.** For example:

   > **Expected:** `0, 1, 2, 3, 4`
   > **Actual:** `0, 1, 2, 3`

4. **Any error message** Breeze printed, including the line number.

5. **Your environment:** operating system, Rust version (`rustc --version`),
   and whether you ran a release binary or `cargo run`.

### Feature requests

Tell us the problem you are trying to solve before describing the solution.
"Beginners struggle with X" is much more useful than "add feature Y", because
it lets us choose the most Breeze-flavoured way to address it.

### Security issues

If you believe you have found a way to break out of the sandbox (filesystem,
network, or process access from a Breeze program), **please do not open a
public issue**. Instead, email the maintainers privately so we can fix it
before disclosure.

---

Thank you for contributing to Breeze. Every issue filed, every example
polished, and every line of code reviewed makes the language a little gentler
for the next beginner who tries it. We're glad you're here. 🌬️
