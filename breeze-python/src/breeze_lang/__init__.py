"""Breeze — the easiest programming language. Python bindings.

Run Breeze programs from Python:

    import breeze_lang as breeze
    result = breeze.run('show "Hello from Breeze!" 1 + 2')
    for line in result["output"]:
        print(line)

This package requires the Breeze runtime (Node.js). Install it with:

    npm install -g breeze-lang

Or point ``BREEZE_PATH`` at a custom ``breeze`` executable.
"""

import os
import shutil
import subprocess
from pathlib import Path


__version__ = "1.2.0"


class BreezeError(Exception):
    """Raised when a Breeze program fails to run."""
    pass


def _find_breeze():
    """Locate the breeze executable.

    Resolution order:
      1. ``$BREEZE_PATH`` environment variable (if it points to a file).
      2. The ``breeze`` executable on ``$PATH``.
      3. Raise :class:`BreezeError` with install instructions.
    """
    env_path = os.environ.get("BREEZE_PATH")
    if env_path and os.path.isfile(env_path):
        return env_path
    found = shutil.which("breeze")
    if found:
        return found
    raise BreezeError(
        "Breeze runtime not found. Install it with:  npm install -g breeze-lang\n"
        "Or set the BREEZE_PATH environment variable to the breeze executable."
    )


def _parse_error_line(stderr_text):
    """Pull the line number out of an error string of the form
    ``Error (line 7): ...``. Returns ``None`` if not present."""
    if not stderr_text:
        return None
    marker = "(line "
    idx = stderr_text.find(marker)
    if idx < 0:
        return None
    rest = stderr_text[idx + len(marker):]
    end = rest.find(")")
    if end < 0:
        return None
    try:
        return int(rest[:end])
    except ValueError:
        return None


def _run_proc(proc, timeout_kind):
    """Turn a finished :class:`subprocess.CompletedProcess` into a result
    dict. ``timeout_kind`` is just used for the error message text."""
    output = proc.stdout.splitlines() if proc.stdout else []
    if proc.returncode == 0:
        return {"output": output, "error": None, "error_line": None}
    err = (proc.stderr or "").strip()
    line = _parse_error_line(err)
    return {"output": output, "error": err, "error_line": line}


def run(source: str) -> dict:
    """Run Breeze source code.

    Returns a dict with three keys:
      - ``output``: ``list[str]`` — the lines the Breeze program printed.
      - ``error``:  ``str | None`` — the formatted error, if any.
      - ``error_line``: ``int | None`` — the source line number, if known.

    Raises :class:`BreezeError` if the Breeze runtime isn't installed or
    the program times out.
    """
    breeze = _find_breeze()
    try:
        proc = subprocess.run(
            [breeze, "eval", source],
            capture_output=True, text=True, timeout=30,
        )
    except subprocess.TimeoutExpired:
        raise BreezeError("Breeze program timed out (30s limit)")
    except FileNotFoundError as e:
        raise BreezeError(f"Breeze executable disappeared: {e}")
    # The CLI uses exit code 2 for usage errors (missing args, bad command).
    if proc.returncode == 2:
        raise BreezeError(f"Breeze CLI error: {(proc.stderr or '').strip()}")
    return _run_proc(proc, "eval")


def run_file(path: str) -> dict:
    """Run a ``.bz`` file. Returns the same dict shape as :func:`run`."""
    breeze = _find_breeze()
    p = Path(path)
    if not p.is_file():
        raise BreezeError(f"File not found: {path}")
    try:
        proc = subprocess.run(
            [breeze, "run", str(p)],
            capture_output=True, text=True, timeout=60,
        )
    except subprocess.TimeoutExpired:
        raise BreezeError("Breeze program timed out (60s limit)")
    except FileNotFoundError as e:
        raise BreezeError(f"Breeze executable disappeared: {e}")
    if proc.returncode == 2:
        raise BreezeError(f"Breeze CLI error: {(proc.stderr or '').strip()}")
    return _run_proc(proc, "run")


__all__ = ["run", "run_file", "BreezeError", "__version__"]
