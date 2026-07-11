#!/usr/bin/env bash
#
# install.sh — one-liner installer for the Breeze language.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Saff9/Breeze/main/install.sh | bash
#
# This script detects your OS, checks that Node.js 18+ is available, installs
# the `breeze-lang` CLI globally via npm, and verifies the installation. It
# does NOT install Node.js for you — if Node is missing or too old, it prints
# friendly instructions and exits.
#
set -euo pipefail

# --- pretty printing --------------------------------------------------------
BOLD="$(tput bold 2>/dev/null || echo '')"
GREEN="$(tput setaf 2 2>/dev/null || echo '')"
YELLOW="$(tput setaf 3 2>/dev/null || echo '')"
RED="$(tput setaf 1 2>/dev/null || echo '')"
RESET="$(tput sgr0 2>/dev/null || echo '')"

info()  { printf "${BOLD}🌬️  %s${RESET}\n" "$*"; }
ok()    { printf "${GREEN}✓ %s${RESET}\n" "$*"; }
warn()  { printf "${YELLOW}! %s${RESET}\n" "$*"; }
die()   { printf "${RED}✗ %s${RESET}\n" "$*" >&2; exit 1; }

# --- OS detection -----------------------------------------------------------
detect_os() {
  case "$(uname -s)" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "macos" ;;
    *)       echo "unknown" ;;
  esac
}

OS="$(detect_os)"
if [ "$OS" = "unknown" ]; then
  warn "Unrecognised OS: $(uname -s). We'll try anyway — Breeze only needs Node.js."
fi
info "Detected OS: ${OS:-unknown}"

# --- Node.js check ----------------------------------------------------------
need_node() {
  cat <<EOF

${BOLD}Node.js 18 or newer is required.${RESET}

Install it from ${BOLD}https://nodejs.org/${RESET} or use a version manager:

  # nvm (recommended) — https://github.com/nvm-sh/nvm
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  nvm install --lts
  nvm use --lts

  # or, on macOS with Homebrew:
  brew install node

Then re-run this installer.

EOF
}

if ! command -v node >/dev/null 2>&1; then
  warn "Node.js was not found on your PATH."
  need_node
  exit 1
fi

NODE_VERSION_RAW="$(node --version 2>/dev/null || echo v0)"   # e.g. v20.11.1
NODE_VERSION_MAJOR="${NODE_VERSION_RAW#v}"
NODE_VERSION_MAJOR="${NODE_VERSION_MAJOR%%.*}"

info "Found Node.js ${NODE_VERSION_RAW}"

if [ "${NODE_VERSION_MAJOR:-0}" -lt 18 ]; then
  warn "Node.js ${NODE_VERSION_RAW} is too old — Breeze needs 18 or newer."
  need_node
  exit 1
fi

# --- npm check --------------------------------------------------------------
if ! command -v npm >/dev/null 2>&1; then
  die "npm was not found on your PATH. It ships with Node.js — please reinstall Node from https://nodejs.org/"
fi
ok "npm is available ($(npm --version))"

# --- install breeze-lang ----------------------------------------------------
info "Installing ${BOLD}breeze-lang${RESET} globally via npm…"
if ! npm install -g breeze-lang; then
  die "npm install failed. If you see an EACCES error, fix your npm permissions:
       https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally
       …or rerun this script with sudo."
fi

# --- verify -----------------------------------------------------------------
if ! command -v breeze >/dev/null 2>&1; then
  warn "The 'breeze' command isn't on your PATH yet."
  warn "You may need to open a new terminal, or add the npm global bin directory to your PATH."
  die "Installation finished but 'breeze' could not be found."
fi

VERSION_OUTPUT="$(breeze version 2>/dev/null || breeze --version 2>/dev/null || echo unknown)"
ok "Breeze installed: ${VERSION_OUTPUT}"

# --- success ----------------------------------------------------------------
cat <<EOF

${GREEN}${BOLD}🌬️  Breeze is ready to go!${RESET}

Write your first program:

  ${BOLD}echo 'show "Hello, Breeze!"' > hello.bz${RESET}
  ${BOLD}breeze run hello.bz${RESET}

Or try a one-liner:

  ${BOLD}breeze eval 'show 1 + 2'${RESET}

Next steps:
  • Browse the examples:    https://github.com/Saff9/Breeze/tree/main/examples
  • Read the language spec: https://github.com/Saff9/Breeze/blob/main/docs/LANGUAGE_SPEC.md
  • Install the VS Code extension (search "Breeze" in the marketplace)

Happy breezing! 🌬️
EOF
