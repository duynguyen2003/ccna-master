"""Test-only launcher: real callbacks; mock Google unless explicitly live smoke."""

import os

import httpx
import uvicorn

from app.config import Settings
from app.main import create_app
from app.prompts import LIMITS

counts = {"countTokens": 0, "generateContent": 0}


async def provider(request):
    method = request.url.path.split(":")[-1]
    counts[method] += 1
    assert b"PRIVATE_RUBRIC_PY02" not in request.content
    assert b"ACTOR_SECRET_PY02" not in request.content
    if method == "countTokens":
        return httpx.Response(200, json={"totalTokens": 500})
    mode = os.environ.get("PY02_VENDOR_MODE", "good")
    if mode == "429":
        return httpx.Response(429, json={"error": {"message": "synthetic-rate-limit"}})
    output = {
        "summary": "A return route is needed for traffic in both directions.",
        "claimType": "HYPOTHESIS",
        "evidenceIds": [],
        "nextSteps": [],
        "verification": "Compare reachability in both directions.",
        "hintLevel": 1,
    }
    if mode == "invalid-output":
        output["summary"] = "<script>private-output-must-be-rejected</script>"
    if mode == "overlong-output":
        output["summary"] = "x" * (LIMITS["summary"] + 1)
    import json

    body = {
        "responseId": "synthetic-gemini-request",
        "candidates": [
            {"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(output)}]}}
        ],
    }
    if mode != "missing-usage":
        body["usageMetadata"] = {
            "promptTokenCount": 120,
            "candidatesTokenCount": 30,
            "thoughtsTokenCount": 10,
            "totalTokenCount": 160,
        }
    return httpx.Response(200, json=body)


settings = Settings.from_env()
app = create_app(
    settings,
    provider_transport=None
    if os.environ.get("PY02_LIVE_SMOKE") == "1"
    else httpx.MockTransport(provider),
)


@app.get("/test/stats")
async def stats():
    return counts


uvicorn.run(app, host="127.0.0.1", port=settings.port, access_log=False, proxy_headers=False)
