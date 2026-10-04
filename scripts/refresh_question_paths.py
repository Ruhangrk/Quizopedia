#!/usr/bin/env python3
"""Refresh bank JSON `path` fields and remap those strings in history/attempts.json.

Run from repo root:
  python3 scripts/refresh_question_paths.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def repo_root_from_script() -> Path:
    return Path(__file__).resolve().parent.parent


def expected_path_for(file_path: Path, root: Path) -> str:
    rel = file_path.resolve().relative_to(root.resolve())
    return rel.as_posix()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def dump_json(path: Path, data: Any) -> None:
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")


def refresh_question_banks(
    root: Path,
    questions_dir: Path | None = None,
) -> tuple[dict[str, str], list[str], int, int, list[str]]:
    """Return (remap prev->new, modified_lines, unchanged, errors_count, error_msgs)."""
    qdir = questions_dir or (root / "questions")
    remap: dict[str, str] = {}
    modified_lines: list[str] = []
    unchanged = 0
    errors: list[str] = []

    if not qdir.is_dir():
        errors.append(f"questions directory not found: {qdir}")
        return remap, modified_lines, unchanged, len(errors), errors

    files = sorted(qdir.rglob("*.json"))
    # Skip helper/spec non-bank files if any appear later; only treat objects with questions array ideally
    for file_path in files:
        if file_path.name.upper().endswith(".MD") or file_path.suffix != ".json":
            continue
        # Ignore accidental non-bank json under questions if clearly not a bank
        try:
            data = load_json(file_path)
        except Exception as exc:  # noqa: BLE001 - report and continue
            errors.append(f"ERROR  {expected_path_for(file_path, root)}: invalid JSON ({exc})")
            continue

        if not isinstance(data, dict):
            # e.g. not a bank — skip silently
            unchanged += 1
            continue
        if "questions" not in data and "path" not in data and "id" not in data:
            unchanged += 1
            continue

        expected = expected_path_for(file_path, root)
        prev = data.get("path")
        prev_s = prev if isinstance(prev, str) else None

        if prev_s == expected:
            unchanged += 1
            continue

        data["path"] = expected
        try:
            dump_json(file_path, data)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"ERROR  writing {expected}: {exc}")
            continue

        display_prev = prev_s if prev_s is not None else "<missing>"
        if prev_s:
            remap[prev_s] = expected
        modified_lines.append(
            f"MODIFIED  {expected}\n  prev: {display_prev}\n  new:  {expected}"
        )

    return remap, modified_lines, unchanged, len(errors), errors


def remap_history_paths(data: Any, remap: dict[str, str]) -> tuple[Any, int, int]:
    """Apply exact string remaps. Returns (new_data, replacements, attempts_touched)."""
    if not remap:
        return data, 0, 0
    if not isinstance(data, list):
        raise ValueError("history/attempts.json must be a JSON array")

    replacements = 0
    attempts_touched = 0

    def replace_str(value: str) -> str:
        nonlocal replacements
        if value in remap:
            replacements += 1
            return remap[value]
        return value

    new_attempts: list[Any] = []
    for attempt in data:
        if not isinstance(attempt, dict):
            new_attempts.append(attempt)
            continue
        touched_before = replacements
        attempt = dict(attempt)

        sources = attempt.get("sources")
        if isinstance(sources, list):
            attempt["sources"] = [
                replace_str(s) if isinstance(s, str) else s for s in sources
            ]

        items = attempt.get("items")
        if isinstance(items, list):
            new_items = []
            for item in items:
                if isinstance(item, dict) and isinstance(item.get("sourcePath"), str):
                    item = dict(item)
                    item["sourcePath"] = replace_str(item["sourcePath"])
                new_items.append(item)
            attempt["items"] = new_items

        breakdown = attempt.get("breakdown")
        if isinstance(breakdown, dict):
            breakdown = dict(breakdown)
            by_source = breakdown.get("bySource")
            if isinstance(by_source, list):
                new_by = []
                for row in by_source:
                    if isinstance(row, dict) and isinstance(row.get("path"), str):
                        row = dict(row)
                        row["path"] = replace_str(row["path"])
                    new_by.append(row)
                breakdown["bySource"] = new_by
            attempt["breakdown"] = breakdown

        if replacements > touched_before:
            attempts_touched += 1
        new_attempts.append(attempt)

    return new_attempts, replacements, attempts_touched


def refresh_history_file(
    history_file: Path,
    remap: dict[str, str],
) -> tuple[str, bool]:
    """Returns (message, updated)."""
    if not remap:
        return "HISTORY: skipped (no path remaps this run)", False
    if not history_file.is_file():
        return "HISTORY: skipped (file not found)", False

    try:
        data = load_json(history_file)
    except Exception as exc:  # noqa: BLE001
        return f"HISTORY: error reading file ({exc})", False

    try:
        new_data, replacements, attempts_touched = remap_history_paths(data, remap)
    except Exception as exc:  # noqa: BLE001
        return f"HISTORY: error ({exc})", False

    if replacements == 0:
        return "HISTORY: unchanged (no matching old paths)", False

    dump_json(history_file, new_data)
    example_prev, example_new = next(iter(remap.items()))
    msg = (
        f"HISTORY  {history_file.as_posix()}\n"
        f"  remapped sources/fields using {len(remap)} path change(s)\n"
        f"  example: {example_prev} -> {example_new}\n"
        f"  attempts touched: {attempts_touched}\n"
        f"  field replacements: {replacements}"
    )
    return msg, True


def run(root: Path | None = None) -> int:
    root = root or repo_root_from_script()
    remap, modified_lines, unchanged, err_count, error_msgs = refresh_question_banks(root)

    for line in modified_lines:
        print(line)
        print()
    for err in error_msgs:
        print(err)

    history_msg, history_updated = refresh_history_file(root / "history" / "attempts.json", remap)
    print(history_msg)
    print()
    print(f"OK (unchanged banks): {unchanged}")
    print(f"MODIFIED banks: {len(modified_lines)}")
    print(f"HISTORY: {'updated' if history_updated else 'not updated'}")
    print(f"ERRORS: {err_count}")
    return 1 if err_count else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Refresh question bank path fields and history remaps.")
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repo root (default: parent of scripts/)",
    )
    args = parser.parse_args(argv)
    return run(args.root.resolve() if args.root else None)


if __name__ == "__main__":
    sys.exit(main())
