# Package Management & Imports

Breeze has two ways to import modules:

1. **Local Imports:** For modules inside your project directory.
2. **Package Imports:** For libraries fetched from GitHub repositories.

---

## Local Imports

You can split your project across multiple `.bz` files.

```breeze
# main.bz
import { greet, add } from "./utils.bz"

greet("World")
show add(10, 20)
```

```breeze
# utils.bz
export func greet(name):
  show "Hello, {name}!"

export func add(a, b):
  return a + b
```

The import path is relative to the file doing the import. Use `./` or `../` to navigate paths.

---

## Installing GitHub Packages

Install shared code directly from GitHub repositories:

```bash
# Saff9/breeze-string points to github.com/Saff9/breeze-string.git
breeze install Saff9/breeze-string
```

This clones the repository into your local `./breeze_modules/breeze-string/` folder. You can also supply full URLs or SSH clone strings:

```bash
breeze install https://github.com/Saff9/breeze-string.git
breeze install github:Saff9/breeze-string
```

Once installed, import the package by name:

```breeze
import { title_case, pad_left } from "breeze-string"

show title_case("hello world")
```

---

## Managing Dependencies with `breeze.json`

Every project or package uses a `breeze.json` file in the root to declare dependencies.

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "My Breeze app",
  "entry": "main.bz",
  "dependencies": {
    "breeze-string": "Saff9/breeze-string"
  }
}
```

### Initialize a new project
Run `breeze init` in an empty folder to bootstrap the configuration:

```bash
breeze init my-app
```

### Install all dependencies
To install all dependencies declared in `breeze.json` (for example, after cloning a project):

```bash
breeze install
```

### List installed packages
To check what packages are currently installed in the project:

```bash
breeze list
```

---

## Creating & Publishing Your Own Library

1. Create a directory with a `main.bz` and a `breeze.json` file:

```json
{
  "name": "my-lib",
  "version": "1.0.0",
  "entry": "main.bz"
}
```

2. Export your functions from `main.bz`:

```breeze
export func multiply(x, y):
  return x * y
```

3. Push the folder to a GitHub repository (e.g. `yourname/my-lib`).
4. Users can now install and use it in their projects:

```bash
breeze install yourname/my-lib
```

```breeze
import { multiply } from "my-lib"
show multiply(4, 5)
```
