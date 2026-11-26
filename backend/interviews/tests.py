from io import BytesIO
from types import SimpleNamespace
from urllib.error import HTTPError, URLError
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from .ai_service import (
    InterviewGenerationError,
    _official_source_candidate,
    _ollama_generate,
    generate_report,
)
from .models import Interview


class OllamaStreamingTests(TestCase):
    @patch.dict("os.environ", {"OLLAMA_MODEL": "test-model"})
    @patch("interviews.ai_service.urlopen")
    def test_ollama_generation_combines_streamed_json_chunks(self, open_url):
        open_url.return_value = BytesIO(
            b'{"response":"{\\"status\\":","done":false}\n'
            b'{"response":"\\"ready\\"}","done":false}\n'
            b'{"response":"","done":true}\n'
        )

        result = _ollama_generate("test prompt")

        self.assertEqual(result, {"status": "ready"})
        self.assertTrue(open_url.call_args.args[0].data)

    @patch.dict("os.environ", {"OLLAMA_MODEL": "test-model"})
    @patch("interviews.ai_service.urlopen", side_effect=TimeoutError)
    def test_ollama_timeout_returns_actionable_error(self, _open_url):
        with self.assertRaisesRegex(
            InterviewGenerationError,
            "Start Ollama and verify the configured model",
        ):
            _ollama_generate("test prompt")

    @patch.dict("os.environ", {"OLLAMA_MODEL": "test-model"})
    @patch("interviews.ai_service.urlopen", side_effect=URLError("connection refused"))
    def test_ollama_connection_error_returns_actionable_error(self, _open_url):
        with self.assertRaisesRegex(
            InterviewGenerationError,
            "Start Ollama and verify the configured model",
        ):
            _ollama_generate("test prompt")

    @patch.dict("os.environ", {"OLLAMA_MODEL": "test-model"})
    @patch("interviews.ai_service.urlopen")
    def test_ollama_rejects_malformed_stream_event(self, open_url):
        open_url.return_value = BytesIO(b"not-json\n")

        with self.assertRaisesRegex(
            InterviewGenerationError,
            "returned an invalid response",
        ):
            _ollama_generate("test prompt")

    @patch.dict("os.environ", {"OLLAMA_MODEL": "test-model"})
    @patch(
        "interviews.ai_service.urlopen",
        side_effect=HTTPError("http://localhost", 503, "unavailable", None, None),
    )
    def test_ollama_http_error_includes_status(self, _open_url):
        with self.assertRaisesRegex(InterviewGenerationError, "HTTP 503"):
            _ollama_generate("test prompt")


class InterviewReportTests(TestCase):
    @patch("interviews.ai_service._ollama_generate")
    def test_report_accepts_practice_steps_as_step_objects(self, generate):
        generate.return_value = {
            "summary": "Answers were relevant and clear.",
            "strengths": [{"title": "Relevance", "evidence": "You addressed the trade-off."}],
            "improvements": [{"area": "Examples", "evidence": "No example was given.", "action": "Add one."}],
            "criteria": [{"name": "Relevance", "score": 4, "evidence": "The answer addressed the question."}],
            "practice_plan": [{"step": "Practice with a concrete failure scenario."}],
            "response_feedback": [],
        }
        interview = SimpleNamespace(
            topic="distributed systems",
            role_title="software engineer",
            questions=[{"question": "Explain a consistency trade-off."}],
        )

        report = generate_report(interview, ["Consistency adds coordination cost."])

        self.assertEqual(
            report["practice_plan"],
            ["Practice with a concrete failure scenario."],
        )


class InterviewApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="practice@example.test",
            password="Secure-test-Password-932!",
            full_name="Practice Candidate",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("interviews.views.generate_questions")
    def test_prepare_researches_questions_and_persists_interview(self, generate):
        generate.return_value = (
            [{
                "category": "FOUNDATIONS",
                "question": "Explain the topic.",
                "hint": "Use a specific example.",
                "follow_up": "What trade-off did you consider?",
                "source_ids": [1],
            }] * 5,
            [{"title": "Official guide", "url": "https://docs.example.test/guide"}],
        )
        response = self.client.post(
            "/api/interviews/prepare/",
            {
                "candidate_name": "Practice Candidate",
                "role_title": "Engineer",
                "topic": "Distributed systems",
                "focus": "technical",
                "duration_minutes": 45,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        interview = Interview.objects.get(id=response.data["id"])
        self.assertEqual(interview.user, self.user)
        self.assertEqual(interview.topic, "Distributed systems")
        self.assertEqual(len(interview.questions), 5)
        self.assertEqual(len(interview.sources), 1)

    @patch("interviews.views.generate_questions")
    def test_prepare_returns_clear_error_without_persisting_when_research_fails(self, generate):
        from .ai_service import InterviewGenerationError

        generate.side_effect = InterviewGenerationError("No official sources found.")
        response = self.client.post(
            "/api/interviews/prepare/",
            {
                "candidate_name": "Practice Candidate",
                "role_title": "Engineer",
                "topic": "Unknown topic",
                "focus": "balanced",
                "duration_minutes": 30,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(Interview.objects.count(), 0)
        self.assertIn("official sources", response.data["detail"])

    @patch("interviews.views.generate_report")
    def test_completion_saves_answers_report_and_timestamp(self, generate):
        generate.return_value = {
            "summary": "Clear, evidence-based answers.",
            "strengths": [{"title": "Structure", "evidence": "You gave clear examples."}],
            "improvements": [{"area": "Detail", "evidence": "One answer lacked context.", "action": "Add the constraints."}],
            "criteria": [{"name": "Relevance", "score": 4, "evidence": "Answers matched the topic."}],
            "practice_plan": ["Practice concise examples."],
            "response_feedback": [],
        }
        interview = Interview.objects.create(
            user=self.user,
            candidate_name="Practice Candidate",
            role_title="Engineer",
            topic="Distributed systems",
            focus="technical",
            duration_minutes=45,
            questions=[{"question": "Question one"}, {"question": "Question two"}],
            sources=[{"title": "Official guide", "url": "https://docs.example.test/guide"}],
        )

        response = self.client.post(
            f"/api/interviews/{interview.id}/complete/",
            {"answers": ["First answer with evidence.", "Another specific example."], "elapsed_seconds": 300},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        interview.refresh_from_db()
        self.assertEqual(interview.status, Interview.Status.COMPLETED)
        self.assertEqual(len(interview.answers), 2)
        self.assertIsNotNone(interview.completed_at)
        self.assertEqual(interview.report["criteria"][0]["score"], 4)

    def test_other_users_cannot_read_or_delete_interviews(self):
        interview = Interview.objects.create(
            user=self.user,
            candidate_name="Practice Candidate",
            role_title="Engineer",
            topic="Distributed systems",
            focus="technical",
            duration_minutes=45,
        )
        other_user = User.objects.create_user(
            email="other@example.test",
            password="Secure-test-Password-932!",
            full_name="Other Candidate",
        )
        self.client.force_authenticate(other_user)

        self.assertEqual(self.client.get(f"/api/interviews/{interview.id}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/interviews/{interview.id}/").status_code, 404)
        self.assertTrue(Interview.objects.filter(id=interview.id).exists())

    def test_only_https_and_official_or_documentation_style_results_are_selected(self):
        self.assertTrue(_official_source_candidate({
            "url": "https://www.example.gov/guide",
            "title": "Guide",
        }))
        self.assertTrue(_official_source_candidate({
            "url": "https://docs.example.com/guide",
            "title": "Product guide",
        }))
        self.assertFalse(_official_source_candidate({
            "url": "http://docs.example.com/guide",
            "title": "Product guide",
        }))
        self.assertFalse(_official_source_candidate({
            "url": "https://example.com/blog/post",
            "title": "A personal blog",
        }))
