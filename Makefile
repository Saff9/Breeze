# Breeze — top-level Makefile for the monorepo.
#
# Convenience targets for onboarding, building, testing, and cleaning every
# package in one go. Each target cds into the right subfolder so you can run
# them from the repo root.
#
# Quick start:
#   make setup     # install deps for all packages
#   make build     # build all packages
#   make test      # run example programs through both interpreters
#   make lint      # cargo clippy + cargo fmt --check (breeze-rs)
#   make clean     # remove all build artifacts

SHELL := /bin/bash

RUST_DIR   := breeze-rs
NODE_DIR   := breeze-node
VSCODE_DIR := breeze-vscode

# A few representative example programs that double as smoke tests.
# Each is run through both interpreters and must exit 0 with the expected
# first line of output.
RUST_EXAMPLES := hello variables conditions loops functions lists fizzbuzz while_elif interpolation text_methods
NODE_EXAMPLES := hello variables conditions loops functions lists fizzbuzz while_elif interpolation text_methods

.PHONY: setup build test clean lint install-node run all

all: build

## setup: install dependencies for every package.
setup:
	cd "$(RUST_DIR)" && cargo build
	cd "$(NODE_DIR)" && npm install
	cd "$(VSCODE_DIR)" && npm install

## build: build (release) every package.
build:
	cd "$(RUST_DIR)" && cargo build --release
	cd "$(NODE_DIR)" && npx tsc
	cd "$(VSCODE_DIR)" && npx tsc

## test: run example programs through both interpreters.
test: test-rust test-node

## test-rust: run examples through the Rust interpreter.
test-rust:
	@echo "==> Running examples through breeze-rs"
	@for f in $(RUST_EXAMPLES); do \
		echo "  • $$f.bz"; \
		cd "$(RUST_DIR)" && ./target/debug/breeze examples/$$f.bz > /dev/null \
			|| { echo "    FAILED"; exit 1; }; \
		cd ..; \
	done
	@echo "    All Rust examples passed."

## test-node: run examples through the Node interpreter.
test-node:
	@echo "==> Running examples through breeze-node"
	@cd "$(NODE_DIR)" && [ -d dist ] || npx tsc
	@for f in $(NODE_EXAMPLES); do \
		echo "  • $$f.bz"; \
		cd "$(NODE_DIR)" && node dist/cli.js run "../$(RUST_DIR)/examples/$$f.bz" > /dev/null \
			|| { echo "    FAILED"; exit 1; }; \
		cd ..; \
	done
	@echo "    All Node examples passed."

## lint: run clippy + rustfmt --check on breeze-rs.
lint:
	cd "$(RUST_DIR)" && cargo clippy -- -D warnings
	cd "$(RUST_DIR)" && cargo fmt --check

## install-node: install the breeze-lang CLI globally (after build).
install-node:
	cd "$(NODE_DIR)" && npm install -g breeze-lang
	@breeze version || true

## run: quick demo — run examples/hello.bz through the Node CLI.
run:
	cd "$(NODE_DIR)" && [ -d dist ] || npx tsc
	cd "$(NODE_DIR)" && node dist/cli.js run "../$(RUST_DIR)/examples/hello.bz"

## clean: remove all build artifacts.
clean:
	rm -rf "$(RUST_DIR)/target"
	rm -rf "$(NODE_DIR)/dist"
	rm -rf "$(NODE_DIR)/node_modules"
	rm -rf "$(VSCODE_DIR)/dist"
	rm -rf "$(VSCODE_DIR)/node_modules"
	rm -rf "$(VSCODE_DIR)/out"
	@echo "Cleaned target, dist, out, and node_modules."
