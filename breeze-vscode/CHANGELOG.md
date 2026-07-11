# Changelog

All notable changes to the **Breeze** VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-15

### Added

- Initial release of the Breeze VS Code extension.
- Language registration for the `.bz` file extension with the `breeze` language id.
- A complete TextMate grammar (`syntaxes/breeze.tmLanguage.json`) covering:
  - Line comments (`#`)
  - Control keywords (`show`, `if`, `else`, `repeat`, `from`, `to`, `for`, `in`, `func`, `return`)
  - Constants (`true`, `false`, `none`)
  - Logical operators (`and`, `or`, `not`)
  - Built-in functions (`len`, `text`, `number`, `upper`, `lower`, `abs`, `round`, `floor`, `ceil`, `random`, `sum`, `min`, `max`, `push`, `range`, `type`, `join`)
  - Single- and double-quoted strings with escape sequences
  - Numeric literals
  - Arithmetic, comparison, and assignment operators
  - Function definition names (`entity.name.function`)
  - Punctuation (`:`, `,`, `(`, `)`, `[`, `]`)
- A language configuration file enabling Python-like auto-indentation after `:`, bracket matching, comment toggling, and word patterns.
- Code snippets for `show`, `if`, `ifelse`, `repeat`, `repeatrange`, `for`, `func`, `return`, `list`, and a full `fizzbuzz` example.
- The `breeze.runFile` command (with a `$(play)` editor-title button and `Ctrl+Alt+B` / `Cmd+Alt+B` keybinding) that saves the active `.bz` file and runs it via the configured interpreter, showing output in a dedicated **Breeze Output** terminal.
- The `breeze.createProject` command that scaffolds a new Breeze project (`main.bz`, `breeze.json`, `README.md`) in a user-chosen folder and opens it in a new VS Code window.
- Friendly error handling when the interpreter is not found, including a link to install it.
- The `breeze.interpreterPath` configuration setting (default `"breeze"`).
- A polished README with usage, configuration, requirements, and a sample Breeze program.

[1.0.0]: https://github.com/Saff9/Breeze/releases/tag/v1.0.0
