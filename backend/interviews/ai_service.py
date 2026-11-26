import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


class InterviewGenerationError(Exception):
    pass


SOURCE_KEYWORDS = re.compile(
    r"\b(official|documentation|docs|developer|standard|specification|reference|manual|regulation)\b",
    re.IGNORECASE,
)


def _post_json(url, payload, timeout, service_name):
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
            if not isinstance(data, dict):
                raise InterviewGenerationError(f"{service_name} returned an invalid response.")
            if data.get("error"):
                raise InterviewGenerationError(f"{service_name} reported an error.")
            return data
    except HTTPError as exc:
        raise InterviewGenerationError(
            f"{service_name} returned HTTP {exc.code}."
        ) from exc
    except (URLError, TimeoutError) as exc:
        raise InterviewGenerationError(
            f"Could not reach {service_name}. Check its configuration and connection, then try again."
        ) from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InterviewGenerationError(
            f"{service_name} returned an invalid response."
        ) from exc


def _official_source_candidate(result):
    url = result.get("url", "")
    if not isinstance(url, str):
        return False
    try:
        parsed = urlsplit(url)
    except ValueError:
        return False
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return False

    host = parsed.hostname.lower().rstrip(".")
    title = result.get("title", "")
    path = parsed.path.replace("-", " ").replace("_", " ")
    if host.endswith((".gov", ".edu", ".mil", ".int")):
        return True
    return bool(
        host.startswith(("docs.", "developer.", "developers.", "api."))
        or SOURCE_KEYWORDS.search(f"{title} {path}")
    )


def _research_topic(topic, role_title):
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise InterviewGenerationError(
            "Web research is not configured. Add TAVILY_API_KEY to backend/.env."
        )

    response = _post_json(
        "https://api.tavily.com/search",
        {
            "api_key": api_key,
            "query": f"{topic} {role_title} official documentation standards",
            "search_depth": "advanced",
            "max_results": 10,
            "include_answer": False,
            "include_raw_content": False,
        },
        timeout=20,
        service_name="the web research service",
    )

    sources = []
    seen_urls = set()
    for result in response.get("results", []):
        if not isinstance(result, dict) or not _official_source_candidate(result):
            continue
        url = result["url"]
        if url in seen_urls:
            continue
        title = str(result.get("title", "")).strip()
        content = str(result.get("content", "")).strip()
        if not title or not content:
            continue
        seen_urls.add(url)
        sources.append({
            "title": title[:250],
            "url": url,
            "content": content[:3500],
        })
        if len(sources) == 5:
            break

    if not sources:
        raise InterviewGenerationError(
            "No official or authoritative sources were found for that topic. Try a more specific topic."
        )
    return sources


def _ollama_generate(prompt):
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    endpoint = f"{base_url}/generate" if base_url.endswith("/api") else f"{base_url}/api/generate"
    model = os.getenv("OLLAMA_MODEL", "").strip()
    if not model:
        raise InterviewGenerationError(
            "The interview model is not configured. Add OLLAMA_MODEL to backend/.env."
        )

    request = Request(
        endpoint,
        data=json.dumps({
            "model": model,
            "prompt": prompt,
            "stream": True,
            "format": "json",
            "keep_alive": "15m",
            "options": {"temperature": 0.3},
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    chunks = []
    try:
        with urlopen(request, timeout=300) as response:
            for line in response:
                if not line.strip():
                    continue
                try:
                    event = json.loads(line.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    raise InterviewGenerationError(
                        "The local interview model returned an invalid response."
                    ) from exc
                if event.get("error"):
                    raise InterviewGenerationError(
                        "The local interview model reported an error. Check that the configured model is available."
                    )
                chunk = event.get("response", "")
                if not isinstance(chunk, str):
                    raise InterviewGenerationError(
                        "The local interview model returned an invalid response."
                    )
                chunks.append(chunk)
    except HTTPError as exc:
        raise InterviewGenerationError(
            f"The local interview model returned HTTP {exc.code}. Check that the configured model is available."
        ) from exc
    except (URLError, TimeoutError) as exc:
        raise InterviewGenerationError(
            "The local interview model is not responding. Start Ollama and verify the configured model, then try again."
        ) from exc

    generated = "".join(chunks)
    if not generated:
        raise InterviewGenerationError(
            "The interview model did not return generated content."
        )
    try:
        parsed = json.loads(generated)
    except json.JSONDecodeError as exc:
        raise InterviewGenerationError(
            "The interview model returned invalid JSON. Please try again."
        ) from exc
    if not isinstance(parsed, dict):
        raise InterviewGenerationError(
            "The interview model returned an unexpected response."
        )
    return parsed


def generate_questions(topic, role_title, focus):
    research = _research_topic(topic, role_title)
    source_context = [
        {
            "source_id": index,
            "title": source["title"],
            "url": source["url"],
            "content": source["content"],
        }
        for index, source in enumerate(research, start=1)
    ]
    result = _ollama_generate(
        "Create exactly five practical interview questions for a candidate "
        f"preparing for the role {role_title!r}, focused on {focus!r}, about {topic!r}. "
        "Use only facts and concepts supported by the supplied official-source excerpts. "
        "Do not invent claims about the sources. Return JSON with a 'questions' array; "
        "each item must have 'category', 'question', 'hint', 'follow_up', and "
        "'source_ids' (a list of source_id integers used). Questions should be distinct, "
        "clear, answerable, and suitable for an interview. Source excerpts: "
        f"{json.dumps(source_context, ensure_ascii=False)}"
    )
    generated_questions = result.get("questions")
    if not isinstance(generated_questions, list) or len(generated_questions) != 5:
        raise InterviewGenerationError(
            "The interview model did not return five usable questions. Please try again."
        )

    questions = []
    valid_source_ids = set(range(1, len(research) + 1))
    for item in generated_questions:
        if not isinstance(item, dict):
            raise InterviewGenerationError("The interview model returned an invalid question.")
        values = {
            key: str(item.get(key, "")).strip()
            for key in ("category", "question", "hint", "follow_up")
        }
        if not all(values.values()):
            raise InterviewGenerationError("The interview model returned an incomplete question.")
        source_ids = item.get("source_ids", [])
        if not isinstance(source_ids, list):
            source_ids = []
        source_ids = [
            source_id for source_id in source_ids
            if type(source_id) is int and source_id in valid_source_ids
        ]
        questions.append({
            **values,
            "source_ids": source_ids or list(valid_source_ids),
        })

    public_sources = [
        {"title": source["title"], "url": source["url"]}
        for source in research
    ]
    return questions, public_sources


def generate_report(interview, answers):
    response_context = [
        {
            "question": interview.questions[index]["question"],
            "answer": answer,
        }
        for index, answer in enumerate(answers)
        if answer.strip()
    ]
    result = _ollama_generate(
        "Evaluate this candidate's written interview responses for practice and "
        "coaching, using only the supplied answers. The topic is "
        f"{interview.topic!r}; target role is {interview.role_title!r}. "
        "Do not infer vocal delivery, body language, personality, or facts the candidate "
        "did not provide. Be specific, constructive, and fair; distinguish observed "
        "evidence from advice. Return JSON with: 'summary' (string), 'strengths' "
        "(array of objects with 'title' and 'evidence'), 'improvements' (array of "
        "objects with 'area', 'evidence', 'action'), 'criteria' (array of objects with "
        "'name', 'score' integer 1-5, and 'evidence'), 'practice_plan' (array of "
        "specific practice-step strings), and 'response_feedback' (array of objects with "
        "'question', 'what_worked', and 'try_next_time'). Keep scores explicitly about "
        "the written responses and provide evidence for each. Answers: "
        f"{json.dumps(response_context, ensure_ascii=False)}"
    )
    required_lists = ("strengths", "improvements", "criteria", "practice_plan", "response_feedback")
    if not isinstance(result.get("summary"), str) or not result["summary"].strip():
        raise InterviewGenerationError("The interview model returned an incomplete report.")
    if any(not isinstance(result.get(key), list) for key in required_lists):
        raise InterviewGenerationError("The interview model returned an incomplete report.")
    result["practice_plan"] = [
        item.get("step")
        if isinstance(item, dict) and isinstance(item.get("step"), str)
        else item
        for item in result["practice_plan"]
    ]
    if (
        not result["strengths"]
        or not result["improvements"]
        or not result["criteria"]
        or not result["practice_plan"]
        or any(
            not isinstance(item, dict)
            or not isinstance(item.get("title"), str)
            or not isinstance(item.get("evidence"), str)
            for item in result["strengths"]
        )
        or any(
            not isinstance(item, dict)
            or not isinstance(item.get("area"), str)
            or not isinstance(item.get("evidence"), str)
            or not isinstance(item.get("action"), str)
            for item in result["improvements"]
        )
        or any(not isinstance(step, str) or not step.strip() for step in result["practice_plan"])
        or any(
            not isinstance(item, dict)
            or not isinstance(item.get("question"), str)
            or not isinstance(item.get("what_worked"), str)
            or not isinstance(item.get("try_next_time"), str)
            for item in result["response_feedback"]
        )
    ):
        raise InterviewGenerationError("The interview model returned an incomplete report.")
    for criterion in result["criteria"]:
        if (
            not isinstance(criterion, dict)
            or type(criterion.get("score")) is not int
            or not isinstance(criterion.get("name"), str)
            or not isinstance(criterion.get("evidence"), str)
            or not 1 <= criterion["score"] <= 5
        ):
            raise InterviewGenerationError("The interview model returned an invalid report score.")
    return result
