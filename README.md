<div align="center">

<img src="logo/breeze-wordmark.svg" alt="Breeze" width="280"/>

A minimal, readable programming language. No curly braces, no semicolons, no boilerplate.

[![Rust](https://img.shields.io/badge/rust-1.70%2B-orange)](https://www.rust-lang.org)
[![Node](https://img.shields.io/badge/node-18%2B-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-extension-blue)](breeze-vscode/)

</div>

---

Breeze is an indentation-based scripting language. It reads like plain English, handles indentation naturally, and auto-joins strings with numbers so you do not have to write manual type conversions.

You can run it directly on Node.js, drop it into the browser, compile it as a native binary, or interop with Python.

```breeze
name = "World"
show "Hello, {name}!"

repeat i from 1 to 5:
  show "{i} squared is {i * i}"
```

## Why Breeze?

Most languages require memorizing syntax before building anything. Breeze keeps it simple: `show` prints, `repeat` loops, and `func` defines a function. 

Breeze does not try to replace Python or Rust. It is the language you use when you want to write a quick script, build a clean API, teach coding, or add simple logic to a webpage without setting up complex build pipelines.

## Install

Install the Node CLI globally:

```bash
npm install -g breeze-lang
```

Or run from source:

```bash
git clone https://github.com/Saff9/Breeze.git
cd breeze
make setup
```

## Building Websites & Backends

Since Breeze runs directly on top of Node.js, you can build production-ready web servers, REST APIs, and full-stack applications.

Here is a simple REST API in Breeze (`server.bz`):

```breeze
func handle(req):
  method = json.get(req, "method")
  path = json.get(req, "path")
  
  if method == "GET" and path == "/":
    return http.ok("{\"status\":\"running\"}")
    
  if method == "GET" and path == "/hello":
    return http.ok("{\"message\":\"Hello from Breeze!\"}")
    
  return http.error(404, "Page not found")

# Start the server on port 3000
http.listen(3000, handle)
```

Run it:
```bash
breeze run server.bz
```

### Cloud Deployments

Breeze works everywhere Node.js works:

* **Vercel (Serverless):** Export your `handle` function in `api/index.ts` using the Breeze Node SDK wrapper. Details in [deploy/DEPLOY.md](deploy/DEPLOY.md).
* **Render:** Add a new Web Service with start command `npx breeze run src/main.bz`. Expose `PORT` via environment variables.
* **Docker:** Package your app using the provided `Dockerfile` to deploy on Fly.io, Railway, AWS, or GCP.
* **Virtual Machines:** Setup standard Linux systemd services using the `deploy-vm.sh` script.

## Use it with your current stack

### Python Interop
Run Python code from Breeze or call Breeze scripts directly inside Python:

```breeze
show python.run("print([x**2 for x in range(1, 6)])")
show python.call("math", "sqrt", [16])
```

```python
import breeze_lang as breeze
print(breeze.run('show 1 + 2')["output"])
```

### HTML Scripting
Include the browser runtime to write Breeze directly inside HTML:

```html
<script src="breeze.js"></script>
<script type="text/breeze" data-output="out">
  show "Hello from the browser."
  dom.set("content", html.h1("Built with Breeze"))
</script>
```

### VS Code Extension
Syntax highlighting, snippets, and a run command are available in [breeze-vscode/](breeze-vscode).

## Packages & Imports

Initialize a new project and install modules from GitHub:

```bash
breeze init my-app
breeze install Saff9/Breeze
```

```breeze
import { map, filter, sort } from "list"
import { title_case, pad_left } from "string"
import { helper } from "./utils.bz"
```

Official libraries live in [lib/](lib) (including `string`, `list`, `random`, and `validate`). You can publish your own package by pushing a GitHub repo with a `breeze.json` manifest.

## Repository Structure

```
breeze-rs/       Rust interpreter (compiles to a fast, native binary)
breeze-node/     Node.js runtime, CLI, package manager, and stdlib
breeze-browser/  Browser runtime for inline <script> tags
breeze-python/   Python integration library
breeze-vscode/   VS Code extension source code
lib/             Official packages
examples/        Sample web-apis, CLI tools, and full-stack projects
deploy/          Docker, Vercel, Render, and Linux server deployment scripts
docs/            Detailed language spec and package management guides
logo/            Logo source files
```

## Language Features

* **Types:** Numbers, strings, booleans, lists, and `none`
* **Syntax:** `show`, `if/elif/else`, `while`, `repeat`, `repeat i from a to b`, `for x in list`
* **Functions:** `func`, `return`, `break`, `continue`, closures, and nested functions
* **Strings:** Interpolation using `{variable}` and auto-joining types with `+`
* **Errors:** `try/catch` blocks with full call stack trace and column carets
* **Standard Library:** Built-in support for `http`, `json`, `fs`, `env`, `time`, `math`, `html`, `dom`, and `python`

Read the [docs/LANGUAGE_SPEC.md](docs/LANGUAGE_SPEC.md) for the complete reference.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) to get started. The project has zero external runtime dependencies and uses TypeScript. PRs adding standard library functions or examples are welcome.

## License

MIT. See [LICENSE](LICENSE). The logo is CC-BY-4.0 — see [logo/README.md](logo/README.md).
