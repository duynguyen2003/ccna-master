import copy
import dataclasses
import json

import httpx
import pytest
from conftest import SECRET, headers_for
from fastapi.testclient import TestClient

from app.boundary import ANALYZE_PATH
from app.gemini import usage_from
from app.main import create_app
from app.policy import GEMINI_VERSIONS, POLICY
from app.prompts import LIMITS

OUTPUT = {
    "summary": "Return reachability depends on a route back to the source.",
    "claimType": "HYPOTHESIS",
    "evidenceIds": [],
    "nextSteps": [],
    "verification": "Inspect reachability in both directions.",
    "hintLevel": 1,
}
USAGE = {
    "promptTokenCount": 123,
    "candidatesTokenCount": 31,
    "thoughtsTokenCount": 9,
    "totalTokenCount": 163,
}


def response_body(output=None, usage=None):
    return {
        "responseId": "synthetic-provider-id",
        "usageMetadata": copy.deepcopy(USAGE if usage is None else usage),
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {"parts": [{"text": json.dumps(OUTPUT if output is None else output)}]},
            }
        ],
    }


@pytest.fixture
def live_payload(payload):
    payload["providerConfigId"] = "local-gemini-v1"
    payload["versions"].update(GEMINI_VERSIONS)
    payload["policy"].update(maxReasoningTokens=800, maxCostMicros=5800)
    return payload


@pytest.fixture
def live_settings(settings):
    return dataclasses.replace(
        settings,
        mode="gemini",
        environment="local",
        live_enabled=True,
        api_key="synthetic-gemini-key-do-not-use",
    )


def client(settings, node, provider):
    return TestClient(
        create_app(
            settings,
            transport=httpx.MockTransport(node),
            provider_transport=httpx.MockTransport(provider),
        )
    )


def test_preflight_claim_single_generation_receipt_and_full_prompt_count(
    live_payload, live_settings, node
):
    methods = []
    requests = []

    async def provider(request):
        method = request.url.path.split(":")[-1]
        methods.append(method)
        value = json.loads(request.content)
        requests.append(value)
        assert request.url.host == "generativelanguage.googleapis.com"
        assert request.headers["x-goog-api-key"] == live_settings.api_key
        if method == "countTokens":
            assert not node.claimed
            assert value["generateContentRequest"]["model"] == "models/" + POLICY["model"]
            return httpx.Response(200, json={"totalTokens": 500})
        assert node.claimed and not node.receipts
        return httpx.Response(200, json=response_body())

    with client(live_settings, node, provider) as app:
        assert app.get("/health/ready").json()["adapter"] == "gemini"
        response = app.post(ANALYZE_PATH, json=live_payload, headers=headers_for(live_payload))
        assert response.status_code == 200
        assert methods == ["countTokens", "generateContent"]
        assert {
            key: value
            for key, value in requests[0]["generateContentRequest"].items()
            if key != "model"
        } == requests[1]
        assert requests[1]["generationConfig"]["maxOutputTokens"] == 800
        assert "tools" not in requests[1] and "cachedContent" not in requests[1]
        assert live_settings.api_key not in json.dumps(requests)
        receipt = node.receipts[0]
        assert receipt["outcome"] == "RECEIVED" and receipt["usage"] == {
            "status": "FINAL",
            "inputTokens": 123,
            "outputTokens": 31,
            "reasoningTokens": 9,
        }
        assert "output" not in response.json()


@pytest.mark.parametrize(
    "metadata,expected",
    [
        (
            ["invalid-usage-shape"],
            {
                "status": "UNRESOLVED",
                "inputTokens": None,
                "outputTokens": None,
                "reasoningTokens": None,
            },
        ),
        (
            {},
            {
                "status": "UNRESOLVED",
                "inputTokens": None,
                "outputTokens": None,
                "reasoningTokens": None,
            },
        ),
        (
            {"promptTokenCount": 10, "candidatesTokenCount": 5, "totalTokenCount": 15},
            {"status": "FINAL", "inputTokens": 10, "outputTokens": 5, "reasoningTokens": 0},
        ),
        (
            {"promptTokenCount": 10, "candidatesTokenCount": 5, "totalTokenCount": 19},
            {"status": "UNRESOLVED", "inputTokens": 10, "outputTokens": 5, "reasoningTokens": None},
        ),
        (
            {
                "promptTokenCount": True,
                "candidatesTokenCount": 0,
                "thoughtsTokenCount": 0,
                "totalTokenCount": 1,
            },
            {"status": "UNRESOLVED", "inputTokens": None, "outputTokens": 0, "reasoningTokens": 0},
        ),
    ],
)
def test_usage_missing_is_null_and_only_proven_zero_is_inferred(metadata, expected):
    assert usage_from({"usageMetadata": metadata}) == expected


@pytest.mark.parametrize("count", [None, 0, True, 6000, 6001, 1.5])
def test_bad_or_over_budget_preflight_never_claims_or_generates(
    live_payload, live_settings, node, count
):
    methods = []

    async def provider(request):
        methods.append(request.url.path.split(":")[-1])
        return httpx.Response(200, json={"totalTokens": count})

    with client(live_settings, node, provider) as app:
        assert (
            app.post(ANALYZE_PATH, json=live_payload, headers=headers_for(live_payload)).status_code
            == 413
        )
    assert methods == ["countTokens"] and not node.calls


@pytest.mark.parametrize(
    "failure,outcome",
    [
        ("429", "KNOWN_FAILURE"),
        ("500", "OUTCOME_UNKNOWN"),
        ("timeout", "OUTCOME_UNKNOWN"),
        ("malformed", "KNOWN_FAILURE"),
        ("missing-usage", "RECEIVED"),
        ("truncated", "KNOWN_FAILURE"),
        ("secret", "KNOWN_FAILURE"),
        ("bad-json", "KNOWN_FAILURE"),
        ("exceeds", "KNOWN_FAILURE"),
        ("bad-candidate-shape", "KNOWN_FAILURE"),
        ("long-summary", "KNOWN_FAILURE"),
        ("long-step", "KNOWN_FAILURE"),
        ("long-verification", "KNOWN_FAILURE"),
        ("null-command", "KNOWN_FAILURE"),
        ("unknown-command", "KNOWN_FAILURE"),
        ("unknown-evidence", "KNOWN_FAILURE"),
        ("hint-escalation", "KNOWN_FAILURE"),
        ("strong-claim", "KNOWN_FAILURE"),
        ("truncated-context", "KNOWN_FAILURE"),
        ("truncated-context-safe", "RECEIVED"),
    ],
)
def test_provider_faults_keep_accounting_and_never_generate_twice(
    live_payload, live_settings, node, failure, outcome
):
    if failure.startswith("truncated-context"):
        live_payload["context"]["contextTruncated"] = True
    methods = []

    async def provider(request):
        method = request.url.path.split(":")[-1]
        methods.append(method)
        if method == "countTokens":
            return httpx.Response(200, json={"totalTokens": 500})
        if failure.isdecimal():
            return httpx.Response(
                int(failure), json={"error": {"message": "private-provider-detail"}}
            )
        if failure == "timeout":
            raise httpx.ReadTimeout("private-network-detail", request=request)
        if failure == "bad-json":
            return httpx.Response(200, content=b"invalid private-provider-detail")
        value = response_body()
        output = copy.deepcopy(OUTPUT)
        if failure in {"long-summary", "long-verification"}:
            field = failure.removeprefix("long-")
            output[field] = "x" * (LIMITS[field] + 1)
        if failure == "long-step":
            output["nextSteps"] = [{"text": "x" * (LIMITS["step"] + 1)}]
        if failure == "null-command":
            output["nextSteps"] = [{"text": "Quan sát trạng thái cổng.", "commandId": None}]
        if failure == "unknown-command":
            output["nextSteps"] = [{"text": "Quan sát trạng thái cổng.", "commandId": "EX_MISSING"}]
        if failure == "unknown-evidence":
            output["evidenceIds"] = ["EX_MISSING"]
        if failure == "hint-escalation":
            output["hintLevel"] = 3
        if failure == "strong-claim":
            output["claimType"] = "SUPPORTED_FINDING"
        if failure == "truncated-context-safe":
            output["claimType"] = "INSUFFICIENT_CONTEXT"
        value["candidates"][0]["content"]["parts"][0]["text"] = json.dumps(output)
        if failure == "malformed":
            value["candidates"][0]["content"]["parts"][0]["text"] = (
                '{"unknown":"private-provider-detail"}'
            )
        if failure == "secret":
            value["candidates"][0]["content"]["parts"][0]["text"] = json.dumps(
                {**OUTPUT, "summary": live_settings.api_key}
            )
        if failure == "missing-usage":
            value.pop("usageMetadata")
        if failure == "truncated":
            value["candidates"][0]["finishReason"] = "MAX_TOKENS"
        if failure == "bad-candidate-shape":
            value["candidates"] = [None]
        if failure == "exceeds":
            value["usageMetadata"] = {
                "promptTokenCount": 7000,
                "candidatesTokenCount": 5,
                "thoughtsTokenCount": 0,
                "totalTokenCount": 7005,
            }
        return httpx.Response(200, json=value)

    with client(live_settings, node, provider) as app:
        response = app.post(ANALYZE_PATH, json=live_payload, headers=headers_for(live_payload))
        assert response.status_code == 200
        assert methods == ["countTokens", "generateContent"]
        assert len(node.receipts) == 1 and node.receipts[0]["outcome"] == outcome
        assert "private-" not in response.text and live_settings.api_key not in response.text
        if failure in {"malformed", "truncated", "secret", "bad-candidate-shape"}:
            assert node.receipts[0]["usage"]["status"] == "FINAL"
        if failure in {"429", "500", "timeout", "missing-usage", "bad-json"}:
            assert node.receipts[0]["usage"]["status"] == "UNRESOLVED"
        else:
            assert node.receipts[0]["usage"]["status"] == "FINAL"
            if outcome == "KNOWN_FAILURE":
                assert node.receipts[0]["output"] is None
                assert node.receipts[0]["finishReason"] in {
                    "INVALID_OUTPUT",
                    "INCOMPLETE_OUTPUT",
                    "USAGE_EXCEEDS_RESERVATION",
                }


def test_lost_receipt_ack_retries_same_receipt_without_new_generation(
    live_payload, live_settings, node
):
    methods = []
    receipt_requests = []

    async def provider(request):
        methods.append(request.url.path.split(":")[-1])
        return httpx.Response(
            200, json={"totalTokens": 500} if methods[-1] == "countTokens" else response_body()
        )

    async def override(operation, request):
        if operation == "receipt":
            receipt_requests.append(request.content)
            if len(receipt_requests) == 1:
                raise httpx.ReadTimeout("ack-lost", request=request)
        return None

    node.override = override
    with client(live_settings, node, provider) as app:
        assert (
            app.post(ANALYZE_PATH, json=live_payload, headers=headers_for(live_payload)).status_code
            == 200
        )
    assert methods == ["countTokens", "generateContent"]
    assert len(receipt_requests) == 2 and receipt_requests[0] == receipt_requests[1]


def test_same_permit_on_two_python_instances_generates_once(live_payload, live_settings, node):
    methods = []

    async def provider(request):
        methods.append(request.url.path.split(":")[-1])
        return httpx.Response(
            200, json={"totalTokens": 500} if methods[-1] == "countTokens" else response_body()
        )

    with (
        client(live_settings, node, provider) as first,
        client(live_settings, node, provider) as second,
    ):
        assert (
            first.post(
                ANALYZE_PATH, json=live_payload, headers=headers_for(live_payload)
            ).status_code
            == 200
        )
        assert (
            second.post(
                ANALYZE_PATH, json=live_payload, headers=headers_for(live_payload)
            ).status_code
            == 409
        )
    assert methods.count("generateContent") == 1 and len(node.receipts) == 1


def test_gemini_readiness_without_key_or_opt_in_is_disabled(live_settings):
    for settings in [
        dataclasses.replace(live_settings, api_key=""),
        dataclasses.replace(live_settings, live_enabled=False),
    ]:
        with TestClient(create_app(settings)) as app:
            assert app.get("/health/live").status_code == 200
            assert app.get("/health/ready").status_code == 503
    assert SECRET not in repr(live_settings) and live_settings.api_key not in repr(live_settings)


def test_previous_prompt_version_is_rejected_before_preflight_or_claim(
    live_payload, live_settings, node
):
    live_payload["versions"]["promptVersion"] = "gemini-r1-v1"
    methods = []

    async def provider(request):
        methods.append(request.url.path)
        return httpx.Response(200, json={"totalTokens": 500})

    with client(live_settings, node, provider) as app:
        response = app.post(ANALYZE_PATH, json=live_payload, headers=headers_for(live_payload))
    assert response.status_code == 503
    assert not methods and not node.calls
