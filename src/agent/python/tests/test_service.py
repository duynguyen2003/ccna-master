import asyncio
import dataclasses
import json
import logging

import httpx
import pytest
from conftest import SECRET, headers_for
from fastapi.testclient import TestClient

from app.boundary import ANALYZE_PATH
from app.config import Settings
from app.contracts import VERSION, validate
from app.fake import FakeAdapter
from app.main import create_app


def client_for(settings, node, adapter=None):
    return TestClient(create_app(settings, transport=httpx.MockTransport(node), adapter=adapter))


def test_live_and_disabled_readiness_are_distinct_and_private_routes_are_hidden():
    with TestClient(create_app(Settings())) as client:
        assert client.get("/health/live").status_code == 200
        ready = client.get("/health/ready")
        assert ready.status_code == 503 and ready.json()["status"] == "disabled"
        assert client.post(ANALYZE_PATH).json()["error"]["code"] == "AI_DISABLED"
        for path in ["/docs", "/openapi.json", "/redoc", "/not-found"]:
            assert client.get(path).status_code == 404


def test_fake_claim_receipt_ack_order_and_duplicate_rejection(payload, settings, node):
    with client_for(settings, node) as client:
        assert client.get("/health/ready").json()["adapter"] == "fake"
        response = client.post(ANALYZE_PATH, json=payload, headers=headers_for(payload))
        assert response.status_code == 200
        validate("InternalAnalyzeResponse", response.json())
        assert "output" not in response.json()
        assert len(node.calls) == 2 and len(node.receipts) == 1
        assert node.receipts[0]["usage"]["inputTokens"] == 0
        assert node.receipts[0]["output"]["claimType"] == "INSUFFICIENT_CONTEXT"
        duplicate = client.post(ANALYZE_PATH, json=payload, headers=headers_for(payload))
        assert duplicate.status_code == 409
        assert duplicate.json()["error"]["code"] == "AI_DISPATCH_ALREADY_CLAIMED"
        assert len(node.receipts) == 1
        assert response.headers["Cache-Control"] == "private, no-store"


def test_node_state_controls_duplicate_across_two_python_instances(payload, settings, node):
    with client_for(settings, node) as first, client_for(settings, node) as second:
        assert (
            first.post(ANALYZE_PATH, json=payload, headers=headers_for(payload)).status_code == 200
        )
        assert (
            second.post(ANALYZE_PATH, json=payload, headers=headers_for(payload)).status_code == 409
        )
        assert len(node.receipts) == 1


@pytest.mark.parametrize(
    "header,value,expected",
    [
        ("Authorization", "Bearer user-session-token", 401),
        ("X-AI-Claim-Token", "wrong-claim-token", 401),
        ("X-AI-Receipt-Token", "wrong-receipt-token", 401),
        ("X-AI-Contract-Version", "2.0.0", 400),
        ("Content-Type", "text/plain", 400),
        ("Content-Encoding", "gzip", 400),
        ("Content-Length", "65537", 413),
    ],
)
def test_rejected_before_any_node_callback(payload, settings, node, header, value, expected):
    headers = {**headers_for(payload), header: value}
    with client_for(settings, node) as client:
        response = client.post(ANALYZE_PATH, content=json.dumps(payload), headers=headers)
        assert response.status_code == expected
        validate("ErrorResponse", response.json())
        assert not node.calls


@pytest.mark.parametrize(
    "field,value",
    [
        ("requestId", "00000000-0000-4000-8000-000000000001"),
        ("callId", "00000000-0000-4000-8000-000000000002"),
        ("contextHash", "b" * 64),
        ("leaseVersion", 2),
    ],
)
def test_all_binding_fields_are_checked(payload, settings, node, field, value):
    headers = headers_for(payload)
    payload[field] = value
    with client_for(settings, node) as client:
        assert client.post(ANALYZE_PATH, json=payload, headers=headers).status_code == 401
        assert not node.calls


@pytest.mark.parametrize(
    "body",
    [
        b'{"contractVersion":"1.0.0","contractVersion":"1.0.0"}',
        b'{"x":NaN}',
        b'{"x":Infinity}',
        b"\xff",
        b"{",
    ],
)
def test_invalid_json_and_duplicate_fields_are_rejected(payload, settings, node, body):
    with client_for(settings, node) as client:
        assert (
            client.post(ANALYZE_PATH, content=body, headers=headers_for(payload)).status_code == 400
        )
        assert not node.calls


def test_unknown_fields_and_expired_deadline_do_not_reach_node(payload, settings, node):
    with client_for(settings, node) as client:
        payload["endpoint"] = "http://example.invalid/provider"
        assert (
            client.post(ANALYZE_PATH, json=payload, headers=headers_for(payload)).status_code == 400
        )
        del payload["endpoint"]
        payload["deadlineAt"] = "2020-01-01T00:00:00Z"
        assert (
            client.post(ANALYZE_PATH, json=payload, headers=headers_for(payload)).status_code == 409
        )
        assert not node.calls


@pytest.mark.parametrize("mutate", ["provider", "version"])
def test_only_pinned_zero_cost_fake_configuration_is_accepted(payload, settings, node, mutate):
    if mutate == "provider":
        payload["providerConfigId"] = "gemini-live"
    else:
        payload["versions"]["priceVersion"] = "paid-price-v1"
    with client_for(settings, node) as client:
        assert (
            client.post(ANALYZE_PATH, json=payload, headers=headers_for(payload)).status_code == 503
        )
        assert not node.calls


@pytest.mark.parametrize(
    "phase,failure",
    [
        ("claim", "network"),
        ("receipt", "network"),
        ("receipt", "malformed"),
        ("receipt", "redirect"),
        ("receipt", "wrong-call"),
        ("receipt", "oversize"),
        ("claim", "wrong-fence"),
        ("claim", "missing-header"),
    ],
)
def test_callback_failures_never_ack_or_repeat_claim(payload, settings, node, phase, failure):
    async def override(operation, request):
        if operation != phase:
            return None
        if failure == "network":
            raise httpx.ConnectError("secret-canary-must-not-escape", request=request)
        if failure == "redirect":
            return httpx.Response(307, headers={"Location": "http://example.invalid/provider"})
        if failure == "oversize":
            return httpx.Response(200, content=b"x" * 65537)
        if failure == "wrong-call":
            return httpx.Response(
                200,
                json={
                    "contractVersion": VERSION,
                    "data": {
                        "callId": "00000000-0000-4000-8000-000000000001",
                        "receiptHash": "a" * 64,
                        "recorded": True,
                    },
                },
                headers={"X-AI-Contract-Version": VERSION},
            )
        if failure in {"wrong-fence", "missing-header"}:
            data = {
                "callId": payload["callId"],
                "contextHash": payload["contextHash"],
                "leaseVersion": 2 if failure == "wrong-fence" else payload["leaseVersion"],
                "dispatchAuthorized": True,
                "deadlineAt": payload["deadlineAt"],
            }
            return httpx.Response(
                200,
                json={"contractVersion": VERSION, "data": data},
                headers={} if failure == "missing-header" else {"X-AI-Contract-Version": VERSION},
            )
        return httpx.Response(200, json={"debug": "secret-canary"})

    node.override = override
    with client_for(settings, node) as client:
        response = client.post(ANALYZE_PATH, json=payload, headers=headers_for(payload))
        assert response.status_code == 500
        assert "secret-canary" not in response.text
        expected = (
            1
            if phase == "claim"
            else (1 + settings.receipt_attempts if failure == "network" else 2)
        )
        assert len(node.calls) == expected


def test_deadline_cancels_generation_and_records_unknown_before_ack(payload, settings, node):
    class SlowAdapter(FakeAdapter):
        cancelled = False

        async def generate(self, payload):
            try:
                await asyncio.sleep(1)
            except asyncio.CancelledError:
                self.cancelled = True
                raise

    adapter = SlowAdapter()
    settings = dataclasses.replace(settings, max_request_ms=40)
    with client_for(settings, node, adapter) as client:
        response = client.post(ANALYZE_PATH, json=payload, headers=headers_for(payload))
        assert response.status_code == 200 and adapter.cancelled
        assert node.claimed and len(node.receipts) == 1 and len(node.calls) == 2
        assert node.receipts[0]["outcome"] == "OUTCOME_UNKNOWN"
        assert node.receipts[0]["usage"]["status"] == "UNRESOLVED"


def test_errors_and_logs_never_include_tokens_questions_or_exceptions(
    payload, settings, node, caplog
):
    class BrokenAdapter(FakeAdapter):
        async def generate(self, payload):
            raise RuntimeError(SECRET + payload["request"]["message"])

    headers = headers_for(payload)
    with client_for(settings, node, BrokenAdapter()) as client, caplog.at_level(logging.WARNING):
        response = client.post(ANALYZE_PATH, json=payload, headers=headers)
        assert response.status_code == 500
    text = caplog.text + response.text
    assert SECRET not in text and payload["request"]["message"] not in text
    assert headers["Authorization"] not in text


def test_invalid_generated_receipt_is_an_internal_failure_and_is_not_sent(payload, settings, node):
    class InvalidAdapter(FakeAdapter):
        async def generate(self, payload):
            return {"output": "invalid-output-canary"}

    with client_for(settings, node, InvalidAdapter()) as client:
        response = client.post(ANALYZE_PATH, json=payload, headers=headers_for(payload))
        assert response.status_code == 500
        assert response.json()["error"]["code"] == "AI_INTERNAL_ERROR"
        assert "invalid-output-canary" not in response.text
        assert len(node.calls) == 1 and not node.receipts
