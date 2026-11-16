import dataclasses
import json

import httpx
import pytest
from conftest import SECRET, claims_for, sign
from fastapi.testclient import TestClient

from app.boundary import ANALYZE_PATH
from app.config import Settings
from app.errors import ServiceError
from app.gemini import GeminiAdapter
from app.main import create_app
from app.policy import GEMINI_VERSIONS


def production_settings():
    return Settings(
        mode="gemini",
        environment="production",
        service_secret=SECRET,
        key_id="production-v1",
        api_key="synthetic-production-key",
        live_enabled=True,
    )


@pytest.mark.parametrize(
    "change",
    [
        {"live_enabled": False},
        {"api_key": ""},
        {"key_id": "local-v1"},
        {"host": "0.0.0.0"},
        {"mode": "off"},
    ],
)
def test_production_requires_explicit_live_key_identity_and_loopback(change):
    with pytest.raises(ValueError, match="AI_PYTHON_CONFIGURATION_INVALID"):
        dataclasses.replace(production_settings(), **change)


def test_production_adapter_rejects_local_provider_and_unreviewed_versions(payload):
    settings = production_settings()
    adapter = GeminiAdapter(settings, None)
    payload["versions"].update(GEMINI_VERSIONS)
    payload["policy"].update(maxReasoningTokens=800, maxCostMicros=5800)
    payload["providerConfigId"] = "local-gemini-v1"
    with pytest.raises(ServiceError, match="AI_DISABLED"):
        adapter.accepts(payload)
    payload["providerConfigId"] = "gemini-production-v1"
    adapter.accepts(payload)
    payload["versions"]["promptVersion"] = "unreviewed-prompt"
    with pytest.raises(ServiceError, match="AI_DISABLED"):
        adapter.accepts(payload)


def test_production_http_preflight_permit_generation_and_receipt(payload, node):
    payload["providerConfigId"] = "gemini-production-v1"
    payload["versions"].update(GEMINI_VERSIONS)
    payload["policy"].update(maxReasoningTokens=800, maxCostMicros=5800)
    methods = []

    async def provider(request):
        method = request.url.path.split(":")[-1]
        methods.append(method)
        if method == "countTokens":
            assert not node.claimed
            return httpx.Response(200, json={"totalTokens": 100})
        assert node.claimed
        answer = {
            "summary": "Inspect the route in both directions.",
            "claimType": "HYPOTHESIS",
            "evidenceIds": [],
            "nextSteps": [],
            "verification": "Inspect the routing table of the selected device.",
            "hintLevel": 1,
        }
        return httpx.Response(
            200,
            json={
                "responseId": "synthetic-production-response",
                "candidates": [
                    {"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(answer)}]}}
                ],
                "usageMetadata": {
                    "promptTokenCount": 100,
                    "candidatesTokenCount": 50,
                    "thoughtsTokenCount": 0,
                    "totalTokenCount": 150,
                },
            },
        )

    def token(operation):
        return sign(
            {**claims_for(payload, operation), "keyId": "production-v1"}, kid="production-v1"
        )

    app = create_app(
        production_settings(),
        transport=httpx.MockTransport(node),
        provider_transport=httpx.MockTransport(provider),
    )
    with TestClient(app) as client:
        assert client.get("/health/ready").status_code == 200
        result = client.post(
            ANALYZE_PATH,
            json=payload,
            headers={
                "Authorization": "Bearer " + token("ANALYZE"),
                "X-AI-Claim-Token": token("CLAIM"),
                "X-AI-Receipt-Token": token("RECEIPT"),
                "X-AI-Contract-Version": "1.0.0",
            },
        )
        assert result.status_code == 200, result.text
    assert methods == ["countTokens", "generateContent"]
    assert len(node.receipts) == 1
    assert node.receipts[0]["outcome"] == "RECEIVED"
