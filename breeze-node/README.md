# Breeze

> The easiest programming language — now on Node.js.

[![npm version](https://img.shields.io/npm/v/breeze-lang.svg)](https://github.com/Saff9/Breeze)
[![license](https://img.shields.io/npm/l/breeze-lang.svg)](./LICENSE)

Breeze is a small, beginner-friendly, indentation-based language. This package
lets you run Breeze programs on Node.js and deploy them to **Vercel**,
**Render**, Docker, or any Node host.

```breeze
# main.bz
show "Hello from Breeze!"

func greet(name):
  return "Hello, " + name + "!"

show greet("World")

# Standard library
show "Pi is " + math.pi
show json.stringify([["ok", true], ["time", time.now()]])
```

```bash
$ breeze run main.bz
Hello from Breeze!
Hello, World!
Pi is 3.141592653589793
{"ok":true,"time":1783676000000}
```

## Install

```bash
# Install globally for the CLI
npm install -g breeze-lang

# Or use it without installing
npx breeze-lang run main.bz

# Or add it to a project as a regular dependency
npm install breeze-lang
```

Requirements: Node.js 18 or newer. The `http.get` and `http.post` helpers
shell out to `curl`, which is preinstalled on Linux and macOS.

## Quick start

1. Scaffold a new project:

   ```bash
   breeze new my-app
   cd my-app
   npm install
   ```

2. Run it:

   ```bash
   breeze run main.bz
   ```

That's it. You have a working Breeze app.

## CLI reference

| Command                     | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `breeze run <file.bz>`      | Run a Breeze program file                         |
| `breeze eval "<code>"`      | Run a one-line Breeze program                     |
| `breeze new <name>`         | Scaffold a new Breeze project in `./<name>`       |
| `breeze version`            | Print the installed Breeze version                |
| `breeze help`               | Show the help message                             |
| `breeze --version` / `-v`   | Print version                                     |
| `breeze --help` / `-h`      | Show help                                         |

Exit codes: `0` success, `1` runtime error, `2` usage error.

> **Note:** `breeze run` does not force-exit the process when the program
> finishes. If your program starts an HTTP server (with `http.listen`), the
> process keeps running and serving requests until you kill it (Ctrl+C).

## Language tour

Breeze is indentation-based, like Python, but smaller and friendlier.

### Variables, math, text

```breeze
name = "Alice"
age = 25
show "Next year I will be " + (age + 1)
```

The `+` operator auto-converts between text and numbers — no more
`TypeError: cannot add string and number`.

### Conditions

```breeze
score = 85
if score >= 90:
  show "Grade: A"
else:
  if score >= 80:
    show "Grade: B"
  else:
    show "Grade: C"
```

### Loops

```breeze
repeat 3:
  show "Hi!"

repeat i from 1 to 5:
  show i

fruits = ["apple", "banana", "cherry"]
for fruit in fruits:
  show "- " + fruit
```

### Functions

```breeze
func add(a, b):
  return a + b

show add(2, 3)
```

### Lists

```breeze
nums = [10, 20, 30]
show nums[0]            # 10
nums[0] = 99
show len(nums)          # 3
show sum(nums)          # 149
push(nums, 40)
```

### Built-in functions

| Name                          | Description                                       |
| ----------------------------- | ------------------------------------------------- |
| `show a, b, c`                | Print values separated by spaces                  |
| `text(x)`                     | Convert any value to text                         |
| `number(x)`                   | Convert to a number                               |
| `len(x)`                      | Length of text or list                            |
| `upper(s)` / `lower(s)`       | Uppercase / lowercase                             |
| `abs(n)` / `round(n)` / `floor(n)` / `ceil(n)` | Math helpers              |
| `random(a, b)`                | Random integer in `[a, b]`                        |
| `sum(list)`                   | Sum a list of numbers                             |
| `min(a, b, ...)` / `max(a, b, ...)` | Smallest / largest                          |
| `push(list, item)`            | Append to a list (returns the list)               |
| `range(n)` / `range(a, b)`    | Generate a list of integers                       |
| `type(x)`                     | Type name as text                                 |
| `join(list, sep)`             | Join a list into text                             |

### Imports and exports

Split your code across files:

```breeze
# utils.bz
export func greet(name):
  return "Hello, " + name + "!"

export func add(a, b):
  return a + b

export pi = 3.14
```

```breeze
# main.bz
import { greet, add, pi } from "./utils.bz"

show greet("World")
show "2 + 3 = " + add(2, 3)
show "Pi is " + pi
```

Imports are resolved relative to the current file. The `.bz` extension is
optional in the import path. Modules are loaded once and cached.

### Anonymous function literals

You can also create functions inline, without a name:

```breeze
http.listen(3000, func(req):
  return "Hello!"
)
```

## Standard library

The standard library is split into namespaces accessed with `.`:

### `http` — HTTP server and client

```breeze
# Start an HTTP server on port 3000.
# The handler receives a request object (list of [key, value] pairs) with
# keys: method, path, body, headers.
# Return a string (200 OK text/plain) or a list of pairs with keys:
#   status  -> number (default 200)
#   headers -> list of [name, value] pairs
#   body    -> text
http.listen(3000, func(req):
  path = json.get(req, "path")
  if path == "/":
    return "Hello from Breeze!"
  if path == "/json":
    return json.stringify([["ok", true], ["time", time.now()]])
  return [
    ["status", 404],
    ["headers", [["Content-Type", "text/plain"]]],
    ["body", "Not found"]
  ]
)
```

| Function                    | Description                                             |
| --------------------------- | ------------------------------------------------------- |
| `http.listen(port, handler)`| Start a blocking HTTP server on the given port          |
| `http.get(url)`             | Synchronous GET request, returns response body as text  |
| `http.post(url, body)`      | Synchronous POST request, returns response body as text |

> `http.get` and `http.post` shell out to the system `curl` binary. They work
> on Linux, macOS, and most CI environments. For native async HTTP from Node,
> wrap your own `fetch` call and pass results into Breeze.

### `json` — JSON support

Breeze has no built-in "object" type. JSON objects are represented as a
**list of `[key, value]` pairs**. This makes it easy to inspect, build, and
iterate JSON using Breeze's existing list operations.

```breeze
# A JSON object { "name": "Alice", "age": 30 } becomes:
data = [["name", "Alice"], ["age", 30]]

show json.get(data, "name")     # Alice
show json.get(data, "age")      # 30
show json.has(data, "name")     # true
show json.keys(data)            # ["name", "age"]
show json.values(data)          # ["Alice", 30]
show json.stringify(data)       # {"name":"Alice","age":30}

# Parse a JSON string into Breeze values
parsed = json.parse("{\"x\":1,\"y\":[10,20]}")
show json.get(parsed, "x")                # 1
show json.get(parsed, "y")[1]             # 20
```

| Function                    | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `json.parse(text)`          | Parse JSON text into Breeze values (objects → list of pairs) |
| `json.stringify(value)`     | Convert a Breeze value to JSON text                          |
| `json.get(obj, key)`        | Look up a key in a list-of-pairs object                      |
| `json.set(obj, key, value)` | Set a key in a list-of-pairs object (mutates and returns)    |
| `json.has(obj, key)`        | Returns true if the object has the key                       |
| `json.keys(obj)`            | List of keys                                                 |
| `json.values(obj)`          | List of values                                               |

**Serialization rule:** a list is serialized as a JSON object if every
element is a 2-element list whose first element is a string. Otherwise it's
serialized as a JSON array.

### `fs` — file I/O

```breeze
fs.write("/tmp/hello.txt", "Hello!\n")
if fs.exists("/tmp/hello.txt"):
  show fs.read("/tmp/hello.txt")
  show fs.list("/tmp")
fs.append("/tmp/hello.txt", "Another line\n")
fs.remove("/tmp/hello.txt")
```

| Function                       | Description                                  |
| ------------------------------ | -------------------------------------------- |
| `fs.read(path)`                | Read a text file, return contents as text    |
| `fs.write(path, content)`      | Write text to a file (overwrites)            |
| `fs.append(path, content)`     | Append text to a file                        |
| `fs.exists(path)`              | Return `true` / `false`                      |
| `fs.list(path)`                | List directory entries as a list of filenames|
| `fs.remove(path)`              | Delete a file                                |
| `fs.mkdir(path)`               | Create a directory (recursive)               |

### `env` — environment variables

```breeze
env.set("BREEZE_GREETING", "Hello!")
show env.get("BREEZE_GREETING")    # Hello!
show env.get("HOME")               # /home/user (or none if unset)
show env.list()                    # list of all env var names
```

| Function                    | Description                                            |
| --------------------------- | ------------------------------------------------------ |
| `env.get(name)`             | Get an env var as text, or `none` if unset             |
| `env.set(name, value)`      | Set an env var (for the current process)               |
| `env.list()`                | List of all env var names                              |

### `time` — time

```breeze
show time.now()         # Unix timestamp in milliseconds
show time.seconds()     # Unix timestamp in seconds
time.sleep(1000)        # Block for 1 second
```

| Function              | Description                                       |
| --------------------- | ------------------------------------------------- |
| `time.now()`          | Current Unix timestamp in milliseconds            |
| `time.seconds()`      | Current Unix timestamp in seconds                 |
| `time.sleep(ms)`      | Block the program for N milliseconds              |

### `math` — extra math

```breeze
show math.pi            # 3.141592653589793
show math.e             # 2.718281828459045
show math.sqrt(16)      # 4
show math.pow(2, 10)    # 1024
show math.sin(0)        # 0
show math.cos(0)        # 1
show math.log(1)        # 0 (natural log)
show math.min(3, 7)     # 3
show math.max(3, 7)     # 7
```

| Member                    | Description                              |
| ------------------------- | ---------------------------------------- |
| `math.pi`, `math.e`, `math.tau` | Constants                          |
| `math.sqrt(n)`            | Square root                              |
| `math.pow(a, b)`          | Exponentiation                           |
| `math.sin(n)` / `cos(n)` / `tan(n)` | Trigonometric functions         |
| `math.log(n)`             | Natural logarithm                        |
| `math.exp(n)`             | Exponential                              |
| `math.min(...)` / `max(...)` | Min/max of arguments                  |

## Example: a complete web server

Here's a small Breeze web app that serves JSON and uses the standard library.

`main.bz`:

```breeze
# A small JSON API in Breeze

counter = 0

http.listen(3000, func(req):
  path = json.get(req, "path")
  method = json.get(req, "method")
  show method + " " + path

  if path == "/":
    return [
      ["status", 200],
      ["headers", [["Content-Type", "application/json"]]],
      ["body", json.stringify([["service", "breeze"], ["version", "1.0.0"]])]
    ]

  if path == "/visit":
    counter = counter + 1
    return [
      ["status", 200],
      ["headers", [["Content-Type", "application/json"]]],
      ["body", json.stringify([["visits", counter]])]
    ]

  if path == "/time":
    return [
      ["status", 200],
      ["headers", [["Content-Type", "application/json"]]],
      ["body", json.stringify([["now", time.now()]])]
    ]

  return [
    ["status", 404],
    ["headers", [["Content-Type", "text/plain"]]],
    ["body", "Not found: " + path]
  ]
)
```

Run it:

```bash
breeze run main.bz
# Listening on http://localhost:3000
```

In another terminal:

```bash
curl http://localhost:3000/             # {"service":"breeze","version":"1.0.0"}
curl http://localhost:3000/visit        # {"visits":1}
curl http://localhost:3000/visit        # {"visits":2}
curl http://localhost:3000/time         # {"now":1783676000000}
```

## Deploying to Render

Render runs long-lived Node processes, so deploying a Breeze `http.listen`
app works out of the box.

1. Push your project to GitHub with this structure:

   ```
   my-app/
     main.bz
     package.json
   ```

2. `package.json`:

   ```json
   {
     "name": "my-app",
     "version": "1.0.0",
     "scripts": {
       "start": "breeze run main.bz"
     },
     "dependencies": {
       "breeze-lang": "^1.0.0"
     }
   }
   ```

3. In Render, create a new **Web Service**:
   - Build command: `npm install`
   - Start command: `npm start`
   - Port: `3000` (or whatever your Breeze app listens on, set via `$PORT`)

4. To use Render's `$PORT` env var in Breeze:

   ```breeze
   port = number(env.get("PORT"))
   if port == 0:
     port = 3000
   http.listen(port, func(req):
     return "Hello from Render!"
   )
   ```

## Deploying to Vercel (serverless)

Vercel functions are short-lived, so `http.listen` doesn't fit. Instead, use
the Breeze interpreter from a small Node wrapper that calls your exported
`handle` function for each request.

`main.bz`:

```breeze
export func handle(req):
  path = json.get(req, "path")
  method = json.get(req, "method")

  if path == "/":
    return [
      ["status", 200],
      ["headers", [["Content-Type", "application/json"]]],
      ["body", json.stringify([["ok", true], ["runtime", "breeze"]])]
    ]

  if path == "/hello":
    return [
      ["status", 200],
      ["headers", [["Content-Type", "text/plain"]]],
      ["body", "Hello from Breeze on Vercel!"]
    ]

  return [
    ["status", 404],
    ["headers", [["Content-Type", "text/plain"]]],
    ["body", "Not found"]
  ]
```

`api/index.js` (Vercel serverless function):

```javascript
const breeze = require('breeze-lang');
const { readFileSync } = require('fs');

const code = readFileSync('./main.bz', 'utf8');
const tokens = breeze.tokenize(code);
const program = new breeze.Parser(tokens).parse();
const interp = new breeze.Interpreter();
interp.run(program);
const handle = interp.getExport('handle');

function pairGet(obj, key) {
  if (!Array.isArray(obj)) return null;
  for (const item of obj) {
    if (Array.isArray(item) && item.length === 2 && item[0] === key) return item[1];
  }
  return null;
}

module.exports = (req, res) => {
  const request = [
    ['method', req.method || 'GET'],
    ['path', req.url || '/'],
    ['body', typeof req.body === 'string' ? req.body : ''],
    ['headers', []],
  ];

  let result;
  try {
    result = interp.callFunction(handle, [request]);
  } catch (e) {
    res.status(500).send('Breeze error: ' + e.message);
    return;
  }

  let status = 200;
  let body = '';
  const headers = {};
  if (typeof result === 'string') {
    body = result;
  } else if (Array.isArray(result)) {
    const s = pairGet(result, 'status');
    if (typeof s === 'number') status = s;
    const b = pairGet(result, 'body');
    if (b !== null) body = String(b);
    const h = pairGet(result, 'headers');
    if (Array.isArray(h)) {
      for (const item of h) {
        if (Array.isArray(item) && item.length === 2) headers[item[0]] = String(item[1]);
      }
    }
  }
  res.status(status).set(headers).send(body);
};
```

`vercel.json`:

```json
{
  "version": 2,
  "builds": [{ "src": "api/index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "api/index.js" }]
}
```

`package.json`:

```json
{
  "name": "my-breeze-app",
  "dependencies": { "breeze-lang": "^1.0.0" }
}
```

Then `vercel deploy`. Every request invokes your Breeze `handle(req)`
function. The interpreter is loaded once per cold start.

## Deploying with Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install breeze-lang and curl (used by http.get / http.post)
RUN apk add --no-cache curl

COPY package.json ./
RUN npm install --production

COPY main.bz ./

EXPOSE 3000
CMD ["npx", "breeze", "run", "main.bz"]
```

Build and run:

```bash
docker build -t my-breeze-app .
docker run -p 3000:3000 my-breeze-app
```

## Using as a library from Node

```javascript
const breeze = require('breeze-lang');

// Run a Breeze snippet and get the output
const result = breeze.run('show "Hello"; show 1 + 2');
console.log(result.output);    // ['Hello', '3']
console.log(result.error);     // null

// Run a file (its directory becomes the cwd for import resolution)
const fileResult = breeze.runFile('./main.bz');
console.log(fileResult.output);

// Call exported Breeze functions from JS (for serverless wrappers)
const code = `
  export func add(a, b):
    return a + b
`;
const tokens = breeze.tokenize(code);
const program = new breeze.Parser(tokens).parse();
const interp = new breeze.Interpreter();
interp.run(program);
const addFn = interp.getExport('add');
console.log(interp.callFunction(addFn, [2, 3]));   // 5
```

### Public API

```typescript
interface BreezeResult {
  output: string[];
  error: string | null;
  errorLine: number | null;
}

function run(source: string, options?: { cwd?: string }): BreezeResult;
function runFile(path: string): BreezeResult;

class Interpreter {
  constructor(options?: { cwd?: string });
  run(program: Program): string[];
  getExport(name: string): RuntimeValue | undefined;
  callFunction(fn: RuntimeValue, args: RuntimeValue[]): RuntimeValue;
}

function tokenize(source: string): Token[];
class Parser { constructor(tokens: Token[]); parse(): Program; }

function valueToString(v: RuntimeValue): string;
function highlightBreeze(code: string): string; // HTML for display

const EXAMPLES: BreezeExample[];
const VERSION: string;
```

## Project layout

A scaffolded Breeze project looks like this:

```
my-app/
  main.bz         # Your Breeze program
  package.json    # Node manifest (depends on breeze-lang)
  breeze.json     # Breeze project manifest
  README.md       # Project README
  .gitignore
```

`breeze.json`:

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "entry": "main.bz",
  "language": "breeze"
}
```

## License

MIT © Breeze Language Project
