"""Shared helpers for the project hooks in .claude/hooks/.

Every hook reads the event JSON from stdin, and must never crash the harness:
callers wrap their work and exit 0 on anything unexpected.
"""
import json
import os
import subprocess
import sys
from pathlib import Path


def read_payload():
    """Return the hook's stdin JSON as a dict ({} when absent or malformed)."""
    try:
        data = json.load(sys.stdin)
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def root_for(path, payload):
    """The git top-level containing `path`, resolved from the FILE so a worktree
    edit is judged against that worktree. Falls back to CLAUDE_PROJECT_DIR."""
    d = path if path.is_dir() else path.parent
    while not d.exists() and d != d.parent:
        d = d.parent
    try:
        out = subprocess.run(
            ["git", "-C", str(d), "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, timeout=10, check=True,
        )
        if out.stdout.strip():
            return Path(out.stdout.strip()).resolve()
    except Exception:
        pass
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    return Path(env or payload.get("cwd") or os.getcwd()).resolve()


def target_path(payload):
    """Absolute path of the file an Edit/Write call targets, or None."""
    raw = (payload.get("tool_input") or {}).get("file_path")
    if not raw or not isinstance(raw, str):
        return None
    p = Path(raw)
    if not p.is_absolute():
        p = Path(payload.get("cwd") or os.getcwd()) / p
    return p.resolve()


def relative_to(path, root):
    """path relative to root, or None when it lies outside it."""
    try:
        return path.relative_to(root)
    except ValueError:
        return None


def emit(obj):
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()
