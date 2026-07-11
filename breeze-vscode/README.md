# Breeze for Visual Studio Code

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Saff9/Breeze)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![VS Code Engine](https://img.shields.io/badge/VS%20Code-1.80%2B-blue.svg)](https://code.visualstudio.com/)
[![Breeze](https://img.shields.io/badge/Breeze-Language-6C5CE7.svg)](https://github.com/Saff9/Breeze)

> Language support for **Breeze** — the easiest programming language.

Breeze is a beginner-friendly, indentation-based programming language designed to be simpler than Python while still being genuinely useful. This extension provides first-class Breeze support in Visual Studio Code.

## Features

- 🎨 **Syntax Highlighting** — A complete TextMate grammar that highlights keywords, strings, numbers, comments, built-in functions, and operators.
- 📝 **Smart Snippets** — Time-saving snippets for `show`, `if`/`else`, `repeat`, `for`, `func`, and a full FizzBuzz template.
- ▶️ **Run Breeze Files** — Run any `.bz` file directly from the editor with a single click (or `Ctrl+Alt+B` / `Cmd+Alt+B`). Output is shown in a dedicated **Breeze Output** terminal.
- 🏗️ **Project Scaffolding** — The `Breeze: Create New Project` command generates a new Breeze project folder complete with `main.bz`, `breeze.json`, and `README.md`.
- 🧠 **Indentation-Aware Editing** — Auto-indentation after colons, bracket matching, comment toggling (`#`), and intelligent word selection.
- ⚙️ **Configurable Interpreter** — Point the extension at any Breeze interpreter executable via a single setting.

## Installation

### From the VS Code Marketplace

1. Open VS Code.
2. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Search for **Breeze**.
4. Click **Install**.

### From a .vsix file

If you have a packaged `.vsix` file:

```sh
code --install-extension breeze-1.0.0.vsix
```

Or from the Extensions view, open the `...` menu → **Install from VSIX...** and select the file.

### Building from source

```sh
git clone https://github.com/Saff9/Breeze.git
cd breeze-vscode
npm install
npm run compile
```

Then press `F5` in VS Code to launch an Extension Development Host with Breeze loaded.

## Usage

### Running a Breeze file

1. Open any `.bz` file.
2. Run it using one of:
   - The ▶️ **Run File** button in the editor title bar
   - The Command Palette → `Breeze: Run File`
   - The keyboard shortcut `Ctrl+Alt+B` (Windows/Linux) or `Cmd+Alt+B` (macOS)

Program output (and any errors) is shown in the **Breeze Output** terminal.

### Creating a new project

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run **Breeze: Create New Project**.
3. Enter a project name, choose a parent folder, and the extension will scaffold a new project (with `main.bz`, `breeze.json`, and `README.md`) and open it in a new VS Code window.

### A sample Breeze program

```breeze
# Greet the world
show "Hello, World!"

# Variables and math
name = "Breeze"
show "Hello, " + name

# A loop with a function
func square(n):
  return n * n

repeat i from 1 to 5:
  show square(i)

# Work with lists
nums = [1, 2, 3, 4, 5]
show "Sum is " + sum(nums)
show "Max is " + max(nums)

# FizzBuzz
repeat n from 1 to 15:
  if n % 15 == 0:
    show "FizzBuzz"
  else if n % 3 == 0:
    show "Fizz"
  else if n % 5 == 0:
    show "Buzz"
  else:
    show n
```

## Configuration

This extension contributes the following settings:

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `breeze.interpreterPath` | `string` | `"breeze"` | Path to the breeze interpreter executable. Use a full path (e.g. `/usr/local/bin/breeze`) if `breeze` is not on your `PATH`. |

Example `settings.json`:

```json
{
  "breeze.interpreterPath": "/usr/local/bin/breeze"
}
```

## Requirements

- **Visual Studio Code 1.80 or newer**
- **The Breeze interpreter** must be installed and available on your `PATH` (or pointed to via `breeze.interpreterPath`). Install it from <https://github.com/Saff9/Breeze>.

If the interpreter cannot be found when you run a file, the extension shows a friendly error message with installation instructions.

## Snippets

| Prefix | Expands to |
| --- | --- |
| `show` | `show <value>` |
| `if` | `if <cond>:` block |
| `ifelse` | `if`/`else` block |
| `repeat` | `repeat <n>:` block |
| `repeatrange` | `repeat <i> from <a> to <b>:` block |
| `for` | `for <i> in <list>:` block |
| `func` | `func <name>(<args>):` block |
| `return` | `return <value>` |
| `list` | `[<items>]` |
| `fizzbuzz` | A full FizzBuzz example program |

## License

MIT © Breeze Language Project
