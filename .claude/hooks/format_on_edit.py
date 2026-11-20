#!/usr/bin/env python3
"""PostToolUse (Edit|Write): run prettier --write on the edited file.

Only source files inside this repo, using the repo's own
node_modules/.bin/prettier (the RTK shell hook intercepts `npx`). When prettier
changes the file, tells Claude so it re-reads before the next Edit.
Never blocks: always exits 0.
"""
import subprocess
import sys

from pathlib import Path

# Run with `python3 -I` (no script dir on sys.path), so add this dir explicitly.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import emit, read_payload, relative_to, root_for, target_path

EXTENSIONS = {".ts", ".tsx", ".js", ".mjs", ".css", ".json", ".md", ".yml", ".yaml"}


def main():
    payload = read_payload()
    if payload.get("tool_name") not in ("Edit", "Write"):
        return
    path = target_path(payload)
    if path is None or path.suffix not in EXTENSIONS or not path.is_file():
        return
    root = root_for(path, payload)
    rel = relative_to(path, root)
    if rel is None or "node_modules" in rel.parts:
        return
    prettier = root / "node_modules" / ".bin" / "prettier"
    if not prettier.exists():
        return
    before = path.read_bytes()
    # --ignore-unknown and .prettierignore keep it off files it should not touch.
    subprocess.run(
        [str(prettier), "--write", "--ignore-unknown", "--log-level", "warn", str(path)],
        cwd=str(root), capture_output=True, text=True, timeout=25,
    )
    if path.read_bytes() != before:
        emit({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": f"prettier reformatted {rel}; re-read it before editing again.",
            }
        })


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
