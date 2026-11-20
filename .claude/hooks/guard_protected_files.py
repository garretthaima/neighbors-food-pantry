#!/usr/bin/env python3
"""PreToolUse (Edit|Write): deny edits to protected files.

Denied:
  * EXISTING files under server/migrations/ (applied migrations are immutable;
    write a new migration instead). Creating a new migration file is allowed.
  * any .env* file except .env.example, at any depth.

Exit 0 + JSON hookSpecificOutput.permissionDecision = "deny" blocks the call
and shows the reason to Claude. No output = no decision. Fails OPEN (exit 0,
no output) on anything unexpected so a hook bug never wedges a session.
"""
import sys

from pathlib import Path

# Run with `python3 -I` (no script dir on sys.path), so add this dir explicitly.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import emit, read_payload, relative_to, root_for, target_path


def reason_for(payload):
    path = target_path(payload)
    if path is None:
        return None
    if path.name.startswith(".env") and path.name != ".env.example":
        return f"{path.name} is an env/secret file; edit it by hand, never through Claude."
    rel = relative_to(path, root_for(path, payload))
    if rel is None:
        return None
    if rel.parts[:2] == ("server", "migrations") and path.exists():
        return (
            f"{rel} is an existing migration; applied migrations are immutable. "
            "Create a new migration file instead."
        )
    return None


def main():
    payload = read_payload()
    if payload.get("tool_name") not in ("Edit", "Write"):
        return
    reason = reason_for(payload)
    if reason:
        emit({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": f"Blocked by .claude/hooks/guard_protected_files.py: {reason}",
            }
        })


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
