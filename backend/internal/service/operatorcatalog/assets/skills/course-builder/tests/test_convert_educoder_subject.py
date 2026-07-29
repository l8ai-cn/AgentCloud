from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "convert_educoder_subject.py"
SPEC = importlib.util.spec_from_file_location("convert_educoder_subject", SCRIPT)
assert SPEC and SPEC.loader
converter = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(converter)


class ConvertEducoderSubjectSafetyTest(unittest.TestCase):
    def test_code_markdown_excludes_hidden_tests_and_reference_answers(self) -> None:
        markdown = converter.code_challenge_markdown(
            {
                "subject": "Challenge",
                "task_pass": "Body",
                "test_sets": [
                    {"is_public": True, "is_invisible": False, "input": "public-in", "output": "public-out"},
                    {"is_public": False, "is_invisible": True, "input": "hidden-in", "output": "hidden-out"},
                ],
                "answers": [{"name": "answer", "contents": "reference-secret"}],
            },
            {},
            [],
        )

        self.assertIn("public-in", markdown)
        self.assertIn("public-out", markdown)
        self.assertNotIn("hidden-in", markdown)
        self.assertNotIn("hidden-out", markdown)
        self.assertNotIn("reference-secret", markdown)

    def test_choice_markdown_excludes_correct_answer(self) -> None:
        markdown = converter.choice_challenge_markdown(
            {
                "subject": "Quiz",
                "choices": [
                    {
                        "subject": "Question",
                        "options": [{"option_name": "A1"}, {"option_name": "B1"}],
                        "standard_answer": "B",
                        "answer": "B",
                    }
                ],
            },
            {},
            [],
        )

        self.assertIn("A1", markdown)
        self.assertIn("B1", markdown)
        self.assertNotIn("дұрыс жауап", markdown)
        self.assertNotIn("`B`", markdown)

    def test_html_media_is_converted_to_markdown_links(self) -> None:
        old_url = "/api/attachments/example"
        rewritten = converter.rewrite_attachments(
            f'<img src="{old_url}"><video src="{old_url}"></video>',
            {old_url: "assets/attachments/example.png"},
            [],
        )

        self.assertIn("![](../../../../../assets/attachments/example.png)", rewritten)
        self.assertIn("[Video](../../../../../assets/attachments/example.png)", rewritten)
        self.assertNotIn("<img", rewritten)
        self.assertNotIn("<video", rewritten)

    def test_legacy_toc_placeholder_is_not_emitted_as_a_broken_link(self) -> None:
        rewritten = converter.rewrite_attachments("[Contents](TOC)", {}, [])

        self.assertEqual("**Contents**", rewritten)


if __name__ == "__main__":
    unittest.main()
