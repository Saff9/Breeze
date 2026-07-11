# Breeze — Python bindings

**Breeze** is the easiest programming language. This package lets you run
Breeze programs from Python, and — together with Breeze's built-in `python`
stdlib module — call Python from Breeze too.

> The Breeze language is easy to read, easy to write, and easy to teach.
> Breeze has friendly keywords (`show`, `repeat`, `func`), automatic string
> concatenation with `+`, and a small, batteries-included standard library.

---

## Install

The Python package is a thin wrapper around the Breeze runtime (Node.js), so
you need **both** pieces:

```bash
# 1. The Python package (this repo)
pip install breeze-lang

# 2. The Breeze runtime (runs your Breeze code)
npm install -g breeze-lang
```

If `breeze` isn't on your `PATH` (for example, you installed it with a
different package manager), set the `BREEZE_PATH` environment variable to the
absolute path of the `breeze` executable:

```bash
export BREEZE_PATH=/usr/local/bin/breeze
```

---

## Quick start

```python
import breeze_lang as breeze

result = breeze.run('show "Hello from Breeze!" 1 + 2')
for line in result["output"]:
    print(line)
# Hello from Breeze!
# 3
```

`breeze.run(source)` returns a dict:

| key          | type             | meaning                                              |
| ------------ | ---------------- | ---------------------------------------------------- |
| `output`     | `list[str]`      | The lines the Breeze program printed with `show`.    |
| `error`      | `str \| None`    | The formatted error message, if the program failed.  |
| `error_line` | `int \| None`    | The source line number of the error, if known.       |

`breeze.run_file(path)` runs a `.bz` file and returns the same shape.

If the Breeze runtime isn't installed (or times out), a `BreezeError` is
raised — that's distinct from a runtime error *inside* your Breeze program,
which is returned in the `error` field instead.

---

## API reference

### `breeze.run(source: str) -> dict`

Run Breeze source code. Returns the result dict described above. Times out
after 30 seconds.

```python
result = breeze.run("repeat i from 1 to 5: show i")
print(result["output"])  # ['1', '2', '3', '4', '5']
```

### `breeze.run_file(path: str) -> dict`

Run a `.bz` file. Times out after 60 seconds (Breeze programs that start an
HTTP server intentionally keep running).

```python
result = breeze.run_file("main.bz")
```

### `breeze.BreezeError`

Raised when the Breeze runtime can't be found, the program times out, or the
CLI itself errors out. *Not* raised for runtime errors inside the Breeze
program — those are returned in the `error` field of the result dict.

```python
try:
    result = breeze.run("show 1 + 2")
except breeze.BreezeError as e:
    print("couldn't run Breeze:", e)
```

### `breeze.__version__`

The Python package version (a string like `"1.2.0"`).

---

## Examples

### Call Breeze from Python

```python
import breeze_lang as breeze

# Breeze: define a recursive function and call it.
result = breeze.run('''
  func fib(n):
    if n < 2:
      return n
    else:
      return fib(n - 1) + fib(n - 2)

  repeat i from 0 to 10:
    show "fib(" + i + ") = " + fib(i)
''')

for line in result["output"]:
    print(line)

if result["error"]:
    print("ERROR:", result["error"])
```

### Pass data back and forth

The simplest way to pass data is through text. Use `json` on either side
when you need structure:

```python
import json
import breeze_lang as breeze

# Python → Breeze: pass data as JSON text.
data = json.dumps([1, 2, 3, 4, 5])
breeze_code = f'''
  nums = json.parse("{data}")
  total = 0
  for n in nums:
    total = total + n
  show "Sum: " + total
'''
result = breeze.run(breeze_code)
print(result["output"][0])  # Sum: 15

# Breeze → Python: have Breeze print JSON, then parse it on the Python side.
result = breeze.run('show json.stringify({{name: "Breeze", stars: 42}})')
obj = json.loads(result["output"][0])
print(obj["name"], "has", obj["stars"], "stars")
```

### Use Breeze as a scripting language inside a Python app

Breeze is a great choice for user-supplied scripting or config files — it's
small, friendly, and easy to learn. Drop a `.bz` file next to your Python
code and run it:

```python
import breeze_lang as breeze
from pathlib import Path

def run_user_script(path):
    result = breeze.run_file(path)
    for line in result["output"]:
        print(line)
    if result["error"]:
        raise RuntimeError(f"Breeze error: {result['error']}")
    return result["output"]
```

### Use Breeze WITH Python

The two interop directions work together. From Breeze you can call Python
(via the `python` stdlib), and from Python you can call Breeze (via this
package). Here's the round trip:

**Python side:**

```python
import breeze_lang as breeze

# Run a Breeze program that calls Python's math.sqrt.
result = breeze.run('''
  show "Breeze here — calling Python for the heavy lifting:"
  show "sqrt(144) = " + python.call("math", "sqrt", [144])
  show "Python version: " + python.version()
''')

for line in result["output"]:
    print(line)
```

**Breeze side (saved as `interop.bz`):**

```breeze
# Breeze calling Python — use Python's libraries from Breeze!
show "Python version: " + python.version()

# Run Python code
result = python.run("print([x**2 for x in range(1, 6)])")
show "Squares from Python: " + result

# Call a Python function
squares = python.call("math", "sqrt", [16])
show "sqrt(16) = " + squares
```

Run it with:

```bash
breeze run interop.bz
```

---

## Command-line interface

The Python package also installs a `breeze` script that mirrors the Node CLI:

```bash
breeze run main.bz       # run a Breeze file
breeze eval "show 1 + 2" # run a code string
breeze version           # print the version
```

You can also invoke it as a Python module:

```bash
python -m breeze_lang eval "show 'hi'"
```

---

## License

MIT — see [LICENSE](LICENSE).
