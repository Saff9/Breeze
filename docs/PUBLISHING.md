# Publishing Breeze Releases

Step-by-step instructions to build and publish Breeze releases across registries.

---

## Registry Accounts Needed

Before releasing, make sure you have developer accounts on:
* **npm** (for the Node `breeze-lang` package)
* **PyPI** (for the Python integration)
* **crates.io** (for the Rust native interpreter)
* **VS Code Marketplace** (for the extension)

---

## 1. Node Runtime & CLI (`breeze-lang` on npm)

This is the primary package.

```bash
cd breeze-node

# Install dev dependencies, build TypeScript, and run the test suites
npm install
npm run build
npm test

# Log in (first-time release only)
npm login

# Publish the package
npm publish
```

To update in the future, bump the version in `breeze-node/package.json` and repeat these build/test/publish steps.

---

## 2. Python Integration (`breeze-lang` on PyPI)

```bash
cd breeze-python

# Build the distribution packages
pip install build
python -m build

# Upload packages to PyPI
pip install twine
twine upload dist/*
```

To update, increment the version in `breeze-python/pyproject.toml`, clean the old build (`rm -rf dist`), rebuild, and upload.

---

## 3. Rust Native Interpreter (`breeze` on crates.io)

```bash
cd breeze-rs

# Log in (get your token from crates.io)
cargo login

# Publish
cargo publish
```

To update, increment the version in `breeze-rs/Cargo.toml` and run `cargo publish`.

---

## 4. VS Code Syntax Extension

```bash
cd breeze-vscode

# Install the VS Code Extension CLI globally
npm install -g @vscode/vsce

# Package the extension into a .vsix file
vsce package

# Publish (requires a Personal Access Token from Azure DevOps)
vsce publish
```

---

## Release Checklist

Run these checks before tagging a new release:

- [ ] All JS/TS tests pass: `cd breeze-node && npm test`
- [ ] Rust codebase compiles and clippy runs warning-free: `cd breeze-rs && cargo build && cargo clippy -- -D warnings`
- [ ] Version matched across `breeze-node/package.json`, `breeze-python/pyproject.toml`, `breeze-rs/Cargo.toml`, and `breeze-vscode/package.json`.
- [ ] Changelog updated with the version summary.
- [ ] Tag the git release: `git tag v1.2.0 && git push --tags`
