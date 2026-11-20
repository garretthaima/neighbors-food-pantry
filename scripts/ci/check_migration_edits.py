#!/usr/bin/env python3
"""Fail when a branch edits, deletes or renames a migration that is on the base.

Applied migrations are immutable: the runner records them by name and never
re-runs them. Adding a new file is fine.

Usage: check_migration_edits.py [BASE]   (BASE defaults to origin/main)
"""
import subprocess
import sys

MIGRATIONS = "server/migrations/"


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
    done = subprocess.run(
        ["git", "diff", "--name-status", "--no-renames", f"{base}...HEAD", "--", MIGRATIONS],
        capture_output=True, text=True,
    )
    if done.returncode != 0:
        print(f"Could not diff against {base}: {done.stderr.strip()}", file=sys.stderr)
        return 2
    changed = [line.split("\t", 1) for line in done.stdout.splitlines() if line]
    bad = [(status, path) for status, path in changed if status != "A"]
    for status, path in bad:
        what = "deleted" if status == "D" else "edited"
        print(f"{path} was {what}. Applied migrations are immutable; add a new one.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
