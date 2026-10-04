"""Rigorous tests for scripts/refresh_question_paths.py (stdlib unittest)."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from refresh_question_paths import (  # noqa: E402
    expected_path_for,
    refresh_history_file,
    refresh_question_banks,
    remap_history_paths,
    run,
)


def write_bank(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


class RefreshPathsTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name)
        (self.repo / "questions").mkdir()
        (self.repo / "history").mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_expected_path_uses_forward_slashes(self) -> None:
        f = self.repo / "questions" / "hft" / "a.json"
        f.parent.mkdir(parents=True)
        f.write_text("{}")
        self.assertEqual(expected_path_for(f, self.repo), "questions/hft/a.json")

    def test_unchanged_bank_not_rewritten(self) -> None:
        path = self.repo / "questions" / "hft" / "ok.json"
        expected = "questions/hft/ok.json"
        write_bank(path, {"id": "ok", "title": "OK", "path": expected, "questions": []})
        original_mtime = path.stat().st_mtime_ns

        remap, modified, unchanged, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(remap, {})
        self.assertEqual(modified, [])
        self.assertEqual(unchanged, 1)
        self.assertEqual(errors, 0)
        self.assertEqual(path.stat().st_mtime_ns, original_mtime)

    def test_missing_path_is_filled(self) -> None:
        path = self.repo / "questions" / "hft" / "missing.json"
        write_bank(
            path,
            {
                "id": "missing",
                "title": "Missing",
                "questions": [{"id": "q1", "type": "fib", "prompt": "x", "answers": ["y"]}],
            },
        )
        remap, modified, unchanged, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(errors, 0)
        self.assertEqual(unchanged, 0)
        self.assertEqual(len(modified), 1)
        self.assertEqual(read_json(path)["path"], "questions/hft/missing.json")
        self.assertEqual(remap, {})

    def test_wrong_path_is_fixed_and_remapped(self) -> None:
        path = self.repo / "questions" / "hft" / "latency" / "basics.json"
        write_bank(
            path,
            {
                "id": "basics",
                "title": "Basics",
                "path": "questions/hft/old/basics.json",
                "questions": [],
            },
        )
        remap, modified, unchanged, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(errors, 0)
        self.assertEqual(unchanged, 0)
        self.assertEqual(
            remap,
            {"questions/hft/old/basics.json": "questions/hft/latency/basics.json"},
        )
        self.assertIn("MODIFIED  questions/hft/latency/basics.json", modified[0])
        self.assertIn("prev: questions/hft/old/basics.json", modified[0])
        self.assertEqual(read_json(path)["path"], "questions/hft/latency/basics.json")

    def test_invalid_json_counts_as_error(self) -> None:
        bad = self.repo / "questions" / "bad.json"
        bad.write_text("{not json", encoding="utf-8")
        remap, modified, unchanged, errors, msgs = refresh_question_banks(self.repo)
        self.assertEqual(errors, 1)
        self.assertEqual(remap, {})
        self.assertEqual(modified, [])
        self.assertTrue(any("invalid JSON" in m for m in msgs))

    def test_remap_history_updates_all_path_fields(self) -> None:
        history = [
            {
                "id": "a1",
                "sources": [
                    "questions/hft/old/basics.json",
                    "questions/hft/matching/order-book.json",
                ],
                "items": [
                    {"sourcePath": "questions/hft/old/basics.json", "questionId": "x"},
                    {"sourcePath": "questions/hft/matching/order-book.json", "questionId": "y"},
                ],
                "breakdown": {
                    "bySource": [
                        {"path": "questions/hft/old/basics.json", "correct": 1, "total": 2},
                        {"path": "questions/hft/matching/order-book.json", "correct": 2, "total": 2},
                    ]
                },
            },
            {
                "id": "a2",
                "sources": ["questions/other/untouched.json"],
                "items": [{"sourcePath": "questions/other/untouched.json"}],
                "breakdown": {"bySource": [{"path": "questions/other/untouched.json"}]},
            },
        ]
        remap = {"questions/hft/old/basics.json": "questions/hft/latency/basics.json"}
        new_data, replacements, touched = remap_history_paths(history, remap)
        self.assertEqual(touched, 1)
        self.assertEqual(replacements, 3)
        self.assertEqual(new_data[0]["sources"][0], "questions/hft/latency/basics.json")
        self.assertEqual(new_data[0]["sources"][1], "questions/hft/matching/order-book.json")
        self.assertEqual(new_data[0]["items"][0]["sourcePath"], "questions/hft/latency/basics.json")
        self.assertEqual(
            new_data[0]["breakdown"]["bySource"][0]["path"],
            "questions/hft/latency/basics.json",
        )
        self.assertEqual(new_data[1]["sources"][0], "questions/other/untouched.json")

    def test_remap_history_no_remap_is_noop(self) -> None:
        data = [{"sources": ["questions/a.json"]}]
        new_data, replacements, touched = remap_history_paths(data, {})
        self.assertEqual(new_data, data)
        self.assertEqual(replacements, 0)
        self.assertEqual(touched, 0)

    def test_history_file_updated_end_to_end(self) -> None:
        write_bank(
            self.repo / "questions" / "hft" / "a.json",
            {"id": "a", "title": "A", "path": "questions/old/a.json", "questions": []},
        )
        history_path = self.repo / "history" / "attempts.json"
        history_path.write_text(
            json.dumps(
                [
                    {
                        "id": "att1",
                        "sources": ["questions/old/a.json"],
                        "items": [{"sourcePath": "questions/old/a.json"}],
                        "breakdown": {"bySource": [{"path": "questions/old/a.json"}]},
                    }
                ],
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        code = run(self.repo)
        self.assertEqual(code, 0)
        self.assertEqual(read_json(self.repo / "questions" / "hft" / "a.json")["path"], "questions/hft/a.json")
        hist = read_json(history_path)
        self.assertEqual(hist[0]["sources"], ["questions/hft/a.json"])
        self.assertEqual(hist[0]["items"][0]["sourcePath"], "questions/hft/a.json")
        self.assertEqual(hist[0]["breakdown"]["bySource"][0]["path"], "questions/hft/a.json")

    def test_history_missing_file_skipped(self) -> None:
        write_bank(
            self.repo / "questions" / "x.json",
            {"id": "x", "title": "X", "path": "questions/old/x.json", "questions": []},
        )
        code = run(self.repo)
        self.assertEqual(code, 0)
        self.assertEqual(read_json(self.repo / "questions" / "x.json")["path"], "questions/x.json")

    def test_history_unchanged_when_no_matching_old_paths(self) -> None:
        write_bank(
            self.repo / "questions" / "x.json",
            {"id": "x", "title": "X", "path": "questions/old/x.json", "questions": []},
        )
        history_path = self.repo / "history" / "attempts.json"
        history_path.write_text(
            json.dumps(
                [{"id": "att", "sources": ["questions/other.json"], "items": [], "breakdown": {}}]
            ),
            encoding="utf-8",
        )
        run(self.repo)
        self.assertEqual(read_json(self.repo / "questions" / "x.json")["path"], "questions/x.json")
        self.assertIn("questions/other.json", history_path.read_text(encoding="utf-8"))

    def test_correct_banks_untouched_when_sibling_fixed(self) -> None:
        good = self.repo / "questions" / "good.json"
        bad = self.repo / "questions" / "nested" / "bad.json"
        write_bank(good, {"id": "g", "title": "G", "path": "questions/good.json", "questions": []})
        write_bank(bad, {"id": "b", "title": "B", "path": "questions/wrong.json", "questions": []})
        good_mtime = good.stat().st_mtime_ns
        remap, modified, unchanged, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(errors, 0)
        self.assertEqual(unchanged, 1)
        self.assertEqual(len(modified), 1)
        self.assertEqual(remap, {"questions/wrong.json": "questions/nested/bad.json"})
        self.assertEqual(good.stat().st_mtime_ns, good_mtime)

    def test_refresh_history_file_helper_messages(self) -> None:
        msg, updated = refresh_history_file(self.repo / "history" / "attempts.json", {})
        self.assertFalse(updated)
        self.assertIn("no path remaps", msg)

        msg, updated = refresh_history_file(self.repo / "history" / "attempts.json", {"a": "b"})
        self.assertFalse(updated)
        self.assertIn("file not found", msg)

    def test_real_sample_banks_have_correct_paths(self) -> None:
        samples = sorted(
            p.relative_to(ROOT).as_posix()
            for p in (ROOT / "questions").rglob("*.json")
        )
        self.assertGreaterEqual(len(samples), 10)
        for rel in samples:
            data = read_json(ROOT / rel)
            self.assertEqual(data["path"], rel, msg=rel)

        remap, modified, unchanged, errors, msgs = refresh_question_banks(ROOT)
        self.assertEqual(errors, 0, msgs)
        self.assertEqual(remap, {})
        self.assertEqual(modified, [])
        self.assertEqual(unchanged, len(samples))

    def test_missing_questions_dir_is_error(self) -> None:
        # remove questions/
        (self.repo / "questions").rmdir()
        remap, modified, unchanged, errors, msgs = refresh_question_banks(self.repo)
        self.assertEqual(errors, 1)
        self.assertTrue(any("questions directory not found" in m for m in msgs))
        self.assertEqual(remap, {})
        self.assertEqual(modified, [])

    def test_empty_questions_dir(self) -> None:
        remap, modified, unchanged, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(errors, 0)
        self.assertEqual(unchanged, 0)
        self.assertEqual(modified, [])
        self.assertEqual(remap, {})

    def test_non_string_path_is_replaced_without_remap(self) -> None:
        path = self.repo / "questions" / "weird.json"
        write_bank(
            path,
            {"id": "w", "title": "W", "path": 123, "questions": []},
        )
        remap, modified, unchanged, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(errors, 0)
        self.assertEqual(unchanged, 0)
        self.assertEqual(len(modified), 1)
        self.assertEqual(remap, {})  # no string prev → no history remap key
        self.assertEqual(read_json(path)["path"], "questions/weird.json")
        self.assertIn("prev: <missing>", modified[0])

    def test_null_path_treated_as_missing(self) -> None:
        path = self.repo / "questions" / "nullpath.json"
        write_bank(
            path,
            {"id": "n", "title": "N", "path": None, "questions": []},
        )
        remap, modified, _, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(errors, 0)
        self.assertEqual(remap, {})
        self.assertEqual(read_json(path)["path"], "questions/nullpath.json")
        self.assertEqual(len(modified), 1)

    def test_preserves_other_bank_fields(self) -> None:
        path = self.repo / "questions" / "keep.json"
        write_bank(
            path,
            {
                "id": "keep",
                "title": "Keep Me",
                "path": "questions/old/keep.json",
                "tags": ["dsa", "arrays"],
                "questions": [
                    {
                        "id": "q1",
                        "type": "fib",
                        "prompt": "hi",
                        "answers": ["yo"],
                        "explanation": "because",
                    }
                ],
                "extraMeta": {"author": "ruhang"},
            },
        )
        refresh_question_banks(self.repo)
        data = read_json(path)
        self.assertEqual(data["path"], "questions/keep.json")
        self.assertEqual(data["id"], "keep")
        self.assertEqual(data["title"], "Keep Me")
        self.assertEqual(data["tags"], ["dsa", "arrays"])
        self.assertEqual(data["extraMeta"], {"author": "ruhang"})
        self.assertEqual(data["questions"][0]["explanation"], "because")

    def test_json_array_root_skipped_as_non_bank(self) -> None:
        path = self.repo / "questions" / "list.json"
        path.write_text(json.dumps([1, 2, 3]) + "\n", encoding="utf-8")
        remap, modified, unchanged, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(errors, 0)
        self.assertEqual(modified, [])
        self.assertEqual(unchanged, 1)
        self.assertEqual(remap, {})
        self.assertEqual(read_json(path), [1, 2, 3])

    def test_unrelated_object_json_skipped(self) -> None:
        path = self.repo / "questions" / "config.json"
        path.write_text(json.dumps({"foo": 1}) + "\n", encoding="utf-8")
        remap, modified, unchanged, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(errors, 0)
        self.assertEqual(modified, [])
        self.assertEqual(unchanged, 1)
        self.assertEqual(read_json(path), {"foo": 1})

    def test_deep_nested_path_and_dsa_style(self) -> None:
        path = self.repo / "questions" / "DSA" / "arrays" / "basics.json"
        write_bank(
            path,
            {
                "id": "dsa-arrays-basics",
                "title": "Arrays",
                "path": "questions/old/arrays.json",
                "questions": [],
            },
        )
        remap, modified, _, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(errors, 0)
        self.assertEqual(
            remap,
            {"questions/old/arrays.json": "questions/DSA/arrays/basics.json"},
        )
        self.assertEqual(read_json(path)["path"], "questions/DSA/arrays/basics.json")

    def test_multiple_banks_remapped_and_history_multi(self) -> None:
        write_bank(
            self.repo / "questions" / "a" / "one.json",
            {"id": "one", "title": "One", "path": "questions/old/one.json", "questions": []},
        )
        write_bank(
            self.repo / "questions" / "b" / "two.json",
            {"id": "two", "title": "Two", "path": "questions/old/two.json", "questions": []},
        )
        history_path = self.repo / "history" / "attempts.json"
        history_path.write_text(
            json.dumps(
                [
                    {
                        "id": "att",
                        "sources": [
                            "questions/old/one.json",
                            "questions/old/two.json",
                            "questions/untouched.json",
                        ],
                        "items": [
                            {"sourcePath": "questions/old/one.json"},
                            {"sourcePath": "questions/old/two.json"},
                            {"sourcePath": "questions/untouched.json"},
                        ],
                        "breakdown": {
                            "bySource": [
                                {"path": "questions/old/one.json"},
                                {"path": "questions/old/two.json"},
                                {"path": "questions/untouched.json"},
                            ]
                        },
                    }
                ]
            ),
            encoding="utf-8",
        )
        code = run(self.repo)
        self.assertEqual(code, 0)
        hist = read_json(history_path)
        self.assertEqual(
            hist[0]["sources"],
            [
                "questions/a/one.json",
                "questions/b/two.json",
                "questions/untouched.json",
            ],
        )
        self.assertEqual(hist[0]["items"][0]["sourcePath"], "questions/a/one.json")
        self.assertEqual(hist[0]["items"][1]["sourcePath"], "questions/b/two.json")
        self.assertEqual(hist[0]["breakdown"]["bySource"][1]["path"], "questions/b/two.json")

    def test_idempotent_second_run(self) -> None:
        path = self.repo / "questions" / "x.json"
        write_bank(
            path,
            {"id": "x", "title": "X", "path": "questions/old/x.json", "questions": []},
        )
        history_path = self.repo / "history" / "attempts.json"
        history_path.write_text(
            json.dumps(
                [
                    {
                        "id": "att",
                        "sources": ["questions/old/x.json"],
                        "items": [{"sourcePath": "questions/old/x.json"}],
                        "breakdown": {"bySource": [{"path": "questions/old/x.json"}]},
                    }
                ]
            ),
            encoding="utf-8",
        )
        self.assertEqual(run(self.repo), 0)
        mtime1 = path.stat().st_mtime_ns
        hist1 = history_path.read_text(encoding="utf-8")
        self.assertEqual(run(self.repo), 0)
        self.assertEqual(path.stat().st_mtime_ns, mtime1)
        self.assertEqual(history_path.read_text(encoding="utf-8"), hist1)

    def test_history_not_array_reports_error_without_crash(self) -> None:
        write_bank(
            self.repo / "questions" / "x.json",
            {"id": "x", "title": "X", "path": "questions/old/x.json", "questions": []},
        )
        history_path = self.repo / "history" / "attempts.json"
        history_path.write_text(json.dumps({"not": "array"}), encoding="utf-8")
        msg, updated = refresh_history_file(
            history_path,
            {"questions/old/x.json": "questions/x.json"},
        )
        self.assertFalse(updated)
        self.assertIn("HISTORY: error", msg)
        # original history left intact
        self.assertEqual(read_json(history_path), {"not": "array"})

    def test_history_invalid_json_reports_error(self) -> None:
        history_path = self.repo / "history" / "attempts.json"
        history_path.write_text("{bad", encoding="utf-8")
        msg, updated = refresh_history_file(history_path, {"a": "b"})
        self.assertFalse(updated)
        self.assertIn("error reading file", msg)

    def test_history_malformed_attempt_fields_do_not_crash(self) -> None:
        history = [
            {
                "id": "odd",
                "sources": "not-a-list",
                "items": [{"sourcePath": 99}, "skip-me", {"sourcePath": "questions/old/a.json"}],
                "breakdown": {"bySource": "nope"},
            },
            "not-an-object",
            {
                "id": "ok",
                "sources": ["questions/old/a.json"],
                "items": [],
                "breakdown": {},
            },
        ]
        new_data, replacements, touched = remap_history_paths(
            history,
            {"questions/old/a.json": "questions/a.json"},
        )
        self.assertEqual(replacements, 2)  # one in items, one in sources of ok
        self.assertEqual(touched, 2)
        self.assertEqual(new_data[0]["sources"], "not-a-list")
        self.assertEqual(new_data[0]["items"][2]["sourcePath"], "questions/a.json")
        self.assertEqual(new_data[1], "not-an-object")
        self.assertEqual(new_data[2]["sources"], ["questions/a.json"])

    def test_unicode_content_preserved(self) -> None:
        path = self.repo / "questions" / "unicode.json"
        write_bank(
            path,
            {
                "id": "u",
                "title": "延迟 / Latency",
                "path": "questions/old/u.json",
                "questions": [
                    {
                        "id": "q1",
                        "type": "fib",
                        "prompt": "μs means micro____",
                        "answers": ["seconds", "秒"],
                    }
                ],
            },
        )
        refresh_question_banks(self.repo)
        data = read_json(path)
        self.assertEqual(data["title"], "延迟 / Latency")
        self.assertEqual(data["questions"][0]["answers"][1], "秒")
        self.assertIn("μs", data["questions"][0]["prompt"])

    def test_run_returns_nonzero_on_bank_errors(self) -> None:
        bad = self.repo / "questions" / "bad.json"
        bad.write_text("{not json", encoding="utf-8")
        self.assertEqual(run(self.repo), 1)

    def test_crossed_path_fields_do_not_swap_history(self) -> None:
        """If two banks point at each other's live paths, fix fields but keep history."""
        write_bank(
            self.repo / "questions" / "a" / "x.json",
            {"id": "a", "title": "A", "path": "questions/b/x.json", "questions": []},
        )
        write_bank(
            self.repo / "questions" / "b" / "x.json",
            {"id": "b", "title": "B", "path": "questions/a/x.json", "questions": []},
        )
        history_path = self.repo / "history" / "attempts.json"
        history_path.write_text(
            json.dumps(
                [
                    {
                        "id": "att",
                        "sources": ["questions/a/x.json", "questions/b/x.json"],
                        "items": [
                            {"sourcePath": "questions/a/x.json"},
                            {"sourcePath": "questions/b/x.json"},
                        ],
                        "breakdown": {
                            "bySource": [
                                {"path": "questions/a/x.json"},
                                {"path": "questions/b/x.json"},
                            ]
                        },
                    }
                ],
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        code = run(self.repo)
        self.assertEqual(code, 0)
        self.assertEqual(
            read_json(self.repo / "questions" / "a" / "x.json")["path"],
            "questions/a/x.json",
        )
        self.assertEqual(
            read_json(self.repo / "questions" / "b" / "x.json")["path"],
            "questions/b/x.json",
        )
        # Old bug swapped these to [b, a]. Live paths must stay put.
        hist = read_json(history_path)
        self.assertEqual(hist[0]["sources"], ["questions/a/x.json", "questions/b/x.json"])
        self.assertEqual(hist[0]["items"][0]["sourcePath"], "questions/a/x.json")
        self.assertEqual(hist[0]["items"][1]["sourcePath"], "questions/b/x.json")
        self.assertEqual(hist[0]["breakdown"]["bySource"][0]["path"], "questions/a/x.json")

        remap, modified, _, errors, _ = refresh_question_banks(self.repo)
        self.assertEqual(errors, 0)
        self.assertEqual(remap, {})
        # Second pass: banks already correct, nothing to modify.
        self.assertEqual(modified, [])

    def test_stale_path_that_collides_with_live_bank_skips_history_only(self) -> None:
        """Moved-looking field that still names another live bank: fix JSON, skip history."""
        write_bank(
            self.repo / "questions" / "keep.json",
            {"id": "keep", "title": "Keep", "path": "questions/keep.json", "questions": []},
        )
        write_bank(
            self.repo / "questions" / "moved.json",
            {"id": "moved", "title": "Moved", "path": "questions/keep.json", "questions": []},
        )
        history_path = self.repo / "history" / "attempts.json"
        history_path.write_text(
            json.dumps(
                [
                    {
                        "id": "att",
                        "sources": ["questions/keep.json", "questions/moved.json"],
                        "items": [
                            {"sourcePath": "questions/keep.json"},
                            {"sourcePath": "questions/moved.json"},
                        ],
                        "breakdown": {
                            "bySource": [
                                {"path": "questions/keep.json"},
                                {"path": "questions/moved.json"},
                            ]
                        },
                    }
                ]
            ),
            encoding="utf-8",
        )

        code = run(self.repo)
        self.assertEqual(code, 0)
        self.assertEqual(read_json(self.repo / "questions" / "moved.json")["path"], "questions/moved.json")
        self.assertEqual(read_json(self.repo / "questions" / "keep.json")["path"], "questions/keep.json")
        hist = read_json(history_path)
        # Must not rewrite keep → moved
        self.assertEqual(hist[0]["sources"], ["questions/keep.json", "questions/moved.json"])

    def test_conflicting_remap_same_prev_different_targets(self) -> None:
        write_bank(
            self.repo / "questions" / "a.json",
            {"id": "a", "title": "A", "path": "questions/old/shared.json", "questions": []},
        )
        write_bank(
            self.repo / "questions" / "b.json",
            {"id": "b", "title": "B", "path": "questions/old/shared.json", "questions": []},
        )
        remap, modified, _, errors, msgs = refresh_question_banks(self.repo)
        self.assertEqual(errors, 1)
        self.assertTrue(any("conflicting remap" in m for m in msgs))
        # First writer wins the remap entry; second conflicts
        self.assertEqual(remap, {"questions/old/shared.json": "questions/a.json"})
        self.assertEqual(len(modified), 2)
        self.assertEqual(read_json(self.repo / "questions" / "a.json")["path"], "questions/a.json")
        self.assertEqual(read_json(self.repo / "questions" / "b.json")["path"], "questions/b.json")


if __name__ == "__main__":
    unittest.main()
