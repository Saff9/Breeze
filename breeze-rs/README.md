<div align="center">

# 🌬️ Breeze

**The easiest programming language.**

A beginner-friendly, indentation-based language implemented entirely in **safe Rust**.

[![Rust](https://img.shields.io/badge/rust-1.70%2B-orange.svg)](https://www.rust-lang.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](CHANGELOG.md)
[![No Unsafe](https://img.shields.io/badge/unsafe-0%25-success.svg)](#safety)

</div>

---

## Why Breeze?

Breeze is a programming language designed from the ground up to be **gentle on
beginners**. It removes the friction that makes learning to code frustrating —

| You write…                     | Instead of (Python)…            |
| ------------------------------ | ------------------------------- |
| `show "Hello"`                 | `print("Hello")`                |
| `repeat 5:`                    | `for _ in range(5):`            |
| `repeat i from 1 to 10:`       | `for i in range(1, 11):`        |
| `"Age: " + 25`                 | `"Age: " + str(25)`             |
| `true / false / none`          | `True / False / None`           |

- **Plain English keywords** — `show`, `repeat`, `from`, `to`, `func`.
- **Auto text join** — `"Score: " + 95` just works. No `str()` needed.
- **Friendly errors** — `Error (line 3): Name 'x' is not defined`.
- **No boilerplate** — no semicolons, no curly braces, no `main()`.
- **Infinite-loop protection** — programs are capped at 2 million steps.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Installing](#installing)
- [Your First Program](#your-first-program)
- [Language Tour](#language-tour)
- [Built-in Functions](#built-in-functions)
- [Using the CLI](#using-the-cli)
- [Using as a Library](#using-as-a-library)
- [Architecture](#architecture)
- [Safety](#safety)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

```bash
# Clone and build (requires Rust 1.70+)
git clone https://github.com/Saff9/Breeze.git
cd breeze
cargo build --release

# Run a program
./target/release/breeze examples/hello.bz

# Or evaluate a one-liner
./target/release/breeze -e 'show "Hello, Breeze!"'

# Or start the interactive REPL
./target/release/breeze
```

---

## Installing

### From source

Breeze has **zero external dependencies** — it builds with the standard Rust
toolchain alone.

```bash
cargo install --path .
# or, from a checkout:
cargo build --release
```

The optimized release binary is a single ~470 KB executable with no runtime
dependencies.

### Requirements

- Rust 1.70 or newer (uses edition 2021).

---

## Your First Program

Create a file called `hello.bz`:

```breeze
# Ask for a name and greet them
name = "World"
show "Hello, " + name + "!"

# Count to five
repeat i from 1 to 5:
  show i
```

Run it:

```bash
breeze hello.bz
```

Output:

```
Hello, World!
1
2
3
4
5
```

---

## Language Tour

### Variables

Variables are created the moment you assign to them. No declarations, no types.

```breeze
name = "Alice"
age = 25
height = 5.6
is_admin = true
nothing_here = none
```

### Output

Use `show` to print. Multiple values are separated by spaces.

```breeze
show "Hello"
show "Name:", name
show "Age:", age, "Height:", height
```

### Math

```breeze
show 10 + 3      # 13
show 10 - 3      # 7
show 10 * 3      # 30
show 10 / 3      # 3.3333...
show 10 % 3      # 1
show -5          # -5
```

### Text & numbers mix automatically

The `+` operator auto-joins text with anything — this is Breeze's signature
convenience feature:

```breeze
show "Score: " + 95        # Score: 95
show "Count: " + [1,2,3]   # Count: [1, 2, 3]
```

### Comparisons & logic

```breeze
show 3 == 3       # true
show 3 != 4       # true
show 3 < 5        # true
show 3 >= 3       # true

show true and false    # false
show true or false     # true
show not true          # false
```

### Conditionals

```breeze
score = 85

if score >= 90:
  show "A"
else:
  if score >= 80:
    show "B"
  else:
    show "C"
```

> **Note:** Breeze uses indentation (2+ spaces) to define blocks, just like
> Python. There is no `elif` — nest `if` inside `else` instead, keeping the
> grammar minimal.

### Loops

Three loop forms cover every common case:

```breeze
# 1. Repeat N times
repeat 3:
  show "beep"

# 2. Count from a to b (inclusive)
repeat i from 1 to 5:
  show i

# 3. Loop over a list
for fruit in ["apple", "banana", "cherry"]:
  show fruit
```

### Lists

```breeze
nums = [10, 20, 30]
show nums[0]          # 10
nums[0] = 99
show nums             # [99, 20, 30]

nums = push(nums, 40)
show len(nums)        # 4
show sum(nums)        # 189
```

### Functions

```breeze
func greet(name):
  show "Hello, " + name + "!"

greet("World")

func add(a, b):
  return a + b

show add(10, 20)      # 30
```

Functions support recursion:

```breeze
func factorial(n):
  if n <= 1:
    return 1
  else:
    return n * factorial(n - 1)

show factorial(5)     # 120
```

### Comments

```breeze
# This is a comment — everything after # is ignored
show "hi"  # comments can go here too
```

---

## Built-in Functions

| Function | Description | Example |
|----------|-------------|---------|
| `show(x, ...)` | Print values | `show "hi", 42` |
| `len(x)` | Length of text or list | `len("abc")` → `3` |
| `text(x)` | Convert to text | `text(42)` → `"42"` |
| `number(x)` | Convert to number | `number("3.14")` → `3.14` |
| `type(x)` | Type name | `type(5)` → `"number"` |
| `upper(s)` | Uppercase text | `upper("hi")` → `"HI"` |
| `lower(s)` | Lowercase text | `lower("HI")` → `"hi"` |
| `abs(x)` | Absolute value | `abs(-5)` → `5` |
| `round(x)` | Round to nearest | `round(3.6)` → `4` |
| `floor(x)` | Round down | `floor(3.9)` → `3` |
| `ceil(x)` | Round up | `ceil(3.1)` → `4` |
| `random(a, b)` | Random integer in `[a, b]` | `random(1, 6)` → `4` |
| `sum(list)` | Sum a list of numbers | `sum([1,2,3])` → `6` |
| `min(a, ...)` | Smallest value | `min(3, 1, 2)` → `1` |
| `max(a, ...)` | Largest value | `max(3, 1, 2)` → `3` |
| `push(list, x)` | Append to a list | `push([1], 2)` → `[1, 2]` |
| `range(n)` | List `0..n-1` | `range(3)` → `[0, 1, 2]` |
| `range(a, b)` | List `a..b-1` | `range(2, 5)` → `[2, 3, 4]` |
| `join(list, sep)` | Join list to text | `join(["a","b"], "-")` → `"a-b"` |

---

## Using the CLI

```text
breeze                 Start the interactive REPL
breeze <file.bz>       Run a Breeze source file
breeze -e <program>    Run a one-line program
breeze --version       Print version
breeze --help          Show help
```

### The REPL

```text
$ breeze
breeze> show "hi"
hi
breeze> func sq(n): return n * n
breeze> show sq(7)
49
breeze> exit
```

Multi-line input is supported: end a line with `:` and the REPL will keep
reading until the block is complete.

### Exit codes

| Code | Meaning |
|------|---------|
| `0`  | Success |
| `1`  | Program raised a runtime/compile error |
| `2`  | CLI usage error or I/O failure |

---

## Using as a Library

Breeze is published as a library crate too. Add it to your `Cargo.toml`:

```toml
[dependencies]
breeze = "1.0"
```

Then run a program from Rust:

```rust
use breeze::run;

fn main() {
    let result = run("show 1 + 2");
    for line in &result.output {
        println!("{line}");
    }
    if let Some(err) = &result.error {
        eprintln!("{err}");
    }
}
```

For finer control, use the individual stages:

```rust
use breeze::{tokenize, Parser, Interpreter};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let source = "show \"Hello\"";
    let tokens = tokenize(source)?;
    let program = Parser::new(tokens).parse()?;
    let mut interp = Interpreter::new();
    let output = interp.run(&program)?;
    for line in output {
        println!("{line}");
    }
    Ok(())
}
```

---

## Architecture

Breeze is a classic three-stage interpreter:

```
 Source text
     │
     ▼
┌─────────┐    ┌─────────┐    ┌──────────────┐
│  Lexer  │ →  │  Parser │ →  │ Interpreter  │ → Output
└─────────┘    └─────────┘    └──────────────┘
  tokens         AST          tree-walk
```

| Stage | Module | Responsibility |
|-------|--------|----------------|
| Lexer | `src/lexer.rs` | Source → tokens (handles indentation) |
| Parser | `src/parser.rs` | Tokens → AST (recursive descent) |
| AST | `src/ast.rs` | Token, statement, and expression types |
| Values | `src/value.rs` | Display, truthiness, conversions |
| Interpreter | `src/interpreter.rs` | AST evaluation, built-ins, scoping |
| Errors | `src/error.rs` | `BreezeError` with line numbers |
| CLI | `src/main.rs` | REPL, file runner, `-e` flag |
| Library | `src/lib.rs` | Public API (`run`) |

There is no bytecode compiler or VM — the tree walker is deliberately simple,
keeping the codebase readable and easy to extend.

---

## Safety

Breeze is written in **100% safe Rust** — there is no `unsafe` code anywhere in
the crate. Shared mutable state (environments, list values) uses
`Rc<RefCell<_>>` for verified interior mutability. The interpreter is also
sandboxed:

- **No filesystem access** — Breeze programs cannot read or write files.
- **No network access** — there are no networking built-ins.
- **No system calls** — programs cannot spawn processes or touch the OS.
- **Step cap** — execution is limited to 2,000,000 AST evaluations, so an
  accidental infinite loop can never hang the host.

This makes Breeze safe to run on untrusted input.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for
guidelines on style, testing, and submitting pull requests.

See [LANGUAGE_SPEC.md](LANGUAGE_SPEC.md) for the complete, formal specification
of the language.

---

## License

Breeze is released under the **MIT License**. See [LICENSE](LICENSE) for the
full text.

<div align="center">

---

Made with care for people learning to code. 🌬️

</div>
