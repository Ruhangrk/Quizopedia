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
        for rel in (
            "questions/hft/latency/basics.json",
            "questions/hft/matching/order-book.json",
        ):
            data = read_json(ROOT / rel)
            self.assertEqual(data["path"], rel)

        remap, modified, unchanged, errors, msgs = refresh_question_banks(ROOT)
        self.assertEqual(errors, 0, msgs)
        # Committed samples must remain unchanged by the script
        joined = "\n".join(modified)
        self.assertNotIn("questions/hft/latency/basics.json", joined)
        self.assertNotIn("questions/hft/matching/order-book.json", joined)
        self.assertGreaterEqual(unchanged, 2)


if __name__ == "__main__":
    unittest.main()
