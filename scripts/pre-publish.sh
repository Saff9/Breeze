#!/usr/bin/env bash
# Pre-publish checklist. Run before tagging a release.
# Verifies versions are in sync, packages build, and tests pass.
#
# Usage: ./scripts/pre-publish.sh

set -e

echo "=== Breeze pre-publish check ==="
echo ""

# 1. Version sync
echo "1. Version sync"
NODE_VER=$(grep '"version"' breeze-node/package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
PY_VER=$(grep '^version' breeze-python/pyproject.toml | head -1 | sed 's/version = "\([^"]*\)"/\1/')
RS_VER=$(grep '^version' breeze-rs/Cargo.toml | head -1 | sed 's/version = "\([^"]*\)"/\1/')
VS_VER=$(grep '"version"' breeze-vscode/package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')

echo "   breeze-node:   $NODE_VER"
echo "   breeze-python: $PY_VER"
echo "   breeze-rs:     $RS_VER"
echo "   breeze-vscode: $VS_VER"

if [ "$NODE_VER" != "$PY_VER" ] || [ "$NODE_VER" != "$RS_VER" ] || [ "$NODE_VER" != "$VS_VER" ]; then
  echo "   FAIL: versions are out of sync"
  exit 1
fi
echo "   ok: all versions match ($NODE_VER)"
echo ""

# 2. Node build + test
echo "2. Node package"
cd breeze-node
npm install --silent
npx tsc
npm test
cd ..
echo "   ok: Node builds and tests pass"
echo ""

# 3. VS Code build
echo "3. VS Code extension"
cd breeze-vscode
npm install --silent
npx tsc -p ./
cd ..
echo "   ok: VS Code builds"
echo ""

# 4. Python syntax
echo "4. Python package"
cd breeze-python
python3 -m py_compile src/breeze_lang/__init__.py
python3 -m py_compile src/breeze_lang/cli.py
python3 -m py_compile src/breeze_lang/__main__.py
cd ..
echo "   ok: Python syntax valid"
echo ""

# 5. Rust build (if cargo is available)
if command -v cargo &>/dev/null; then
  echo "5. Rust package"
  cd breeze-rs
  cargo build
  cargo clippy -- -D warnings
  cargo fmt --check
  for f in examples/*.bz; do
    ./target/debug/breeze "$f" > /dev/null
  done
  rm -rf target Cargo.lock
  cd ..
  echo "   ok: Rust builds, clippy clean, examples pass"
else
  echo "5. Rust package (skipped — cargo not installed)"
fi
echo ""

# 6. No build artifacts
echo "6. Source-only check"
ARTIFACTS=$(find breeze-* -type d \( -name node_modules -o -name dist -o -name target -o -name out \) 2>/dev/null)
if [ -n "$ARTIFACTS" ]; then
  echo "   FAIL: build artifacts present:"
  echo "$ARTIFACTS"
  exit 1
fi
echo "   ok: no build artifacts"
echo ""

echo "=== All checks passed. Ready to publish. ==="
echo ""
echo "To release:"
echo "  1. git commit any version bumps"
echo "  2. git tag v$NODE_VER"
echo "  3. git push origin v$NODE_VER"
echo "  4. The release workflow publishes to npm, PyPI, crates.io, and VS Code."
echo ""
echo "Or publish manually — see docs/PUBLISHING.md"
