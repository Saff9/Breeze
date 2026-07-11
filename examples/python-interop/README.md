# Breeze + Python interop example

This example shows Breeze calling Python via the `python` stdlib (added in
Breeze 1.2). The `python` module lets a Breeze program:

- run chunks of Python code (`python.run`)
- call Python functions by module and name (`python.call`)
- evaluate a single Python expression (`python.eval`)
- run a Python file (`python.exec`)
- check the installed Python version (`python.version`)

## Prerequisites

1. **Breeze** — install with `npm install -g breeze-lang` (or run from a
   local clone with `node dist/cli.js`).
2. **Python 3** — install from <https://python.org>. Verify with
   `python3 --version`.

## Run

```bash
breeze run main.bz
```

Expected output (Python version will vary):

```
Python version: Python 3.11.5
Squares from Python: [1, 4, 9, 16, 25]
sqrt(16) = 4.0
Fibonacci from Python: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
2 ** 10 = 1024
Breeze list: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]
Python sum:   44
Python max:   9
Python sorted: [1, 1, 2, 3, 3, 4, 5, 5, 5, 6, 9]
```

## How it works

The `python` stdlib shells out to `python3` (via Node's `child_process`)
under the hood. Arguments are passed as a real argv array — no shell, no
quoting issues — so any character in your Python code (quotes, newlines,
Unicode) is safe. When `python3` isn't installed, you'll get a friendly
error pointing you to <https://python.org>.

The reverse direction — Python calling Breeze — uses the separate
`breeze-lang` pip package (`pip install breeze-lang`), which shells out to
the `breeze` CLI. See the project root README for a full round-trip example.

## Files

- `main.bz` — the Breeze program. Read it top-to-bottom; each block is
  commented.
