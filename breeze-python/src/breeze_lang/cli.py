"""breeze — run Breeze programs (Python entry point).

This CLI mirrors the Node.js ``breeze`` CLI so you can use the same commands
whether you installed Breeze via npm or pip. It shells out to the underlying
Breeze runtime (Node.js), so a working ``breeze`` executable must be on your
PATH (or pointed to by ``BREEZE_PATH``).

Examples:
    breeze run main.bz
    breeze eval "show 1 + 2"
    breeze version
"""
import argparse
import sys

from . import run, run_file, BreezeError, __version__


def main():
    parser = argparse.ArgumentParser(
        prog="breeze",
        description="Run Breeze programs (Python entry point).",
    )
    sub = parser.add_subparsers(dest="command")

    p_run = sub.add_parser("run", help="Run a .bz file")
    p_run.add_argument("file", help="Path to a .bz Breeze program")

    p_eval = sub.add_parser("eval", help="Run a code string")
    p_eval.add_argument("code", help="Breeze source code to evaluate")

    sub.add_parser("version", help="Print the Breeze version")

    args = parser.parse_args()

    if args.command == "run":
        try:
            result = run_file(args.file)
        except BreezeError as e:
            print(e, file=sys.stderr)
            sys.exit(2)
        for line in result["output"]:
            print(line)
        if result["error"]:
            print(result["error"], file=sys.stderr)
            sys.exit(1)
    elif args.command == "eval":
        try:
            result = run(args.code)
        except BreezeError as e:
            print(e, file=sys.stderr)
            sys.exit(2)
        for line in result["output"]:
            print(line)
        if result["error"]:
            print(result["error"], file=sys.stderr)
            sys.exit(1)
    elif args.command == "version":
        print(f"breeze {__version__} (python)")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
