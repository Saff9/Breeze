"""Call Breeze from Python.

This is the Python → Breeze direction of the interop. The reverse direction
(Breeze calling Python via the `python` stdlib) lives in the
`breeze-templates/python-interop/` folder of the monorepo.

Run with:
    python call_breeze.py

Requires the Breeze runtime on your PATH (`npm install -g breeze-lang`) or
the BREEZE_PATH environment variable pointing at a `breeze` executable.
"""
import textwrap

import breeze_lang as breeze


def main():
    # Run Breeze source code. We use a triple-quoted string with a backslash
    # continuation so the first Breeze line starts at column 0 — Breeze is
    # indentation-sensitive, so leading whitespace on the first line would
    # be a syntax error.
    #
    # The result dict has:
    #   output     : list[str]        — lines the Breeze program printed
    #   error      : str | None       — formatted error, if any
    #   error_line : int | None       — source line of the error, if known
    source = textwrap.dedent("""\
        func fib(n):
          if n < 2:
            return n
          else:
            return fib(n - 1) + fib(n - 2)

        repeat i from 0 to 10:
          show "fib(" + i + ") = " + fib(i)
    """)

    result = breeze.run(source)

    for line in result["output"]:
        print(line)

    if result["error"]:
        print("ERROR:", result["error"])


if __name__ == "__main__":
    main()
