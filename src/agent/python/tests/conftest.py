import copy
import hashlib
import json
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx
import jwt
import pytest
from fixtures.fake_adapter import FAKE_VERSIONS

from app.config import Settings
from app.contracts import VERSION, binding, validate

PROJECT = Path(__file__).resolve().parents[1]
CONTRACTS = PROJECT.parent / "contracts" / "ai-lab" / "v1"
SECRET = "synthetic-py01-service-secret-local-only-0001"


@pytest.fixture
def payload():
    value = json.loads((CONTRACTS / "examples/internal-analyze.json").read_text(encoding="utf-8"))
    value["deadlineAt"] = (
        datetime.fromtimestamp(time.time() + 35, UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
    value["providerConfigId"] = "local-gemini-v1"
    value["versions"].update(copy.deepcopy(FAKE_VERSIONS))
    return value


def claims_for(payload, operation="ANALYZE"):
    now = int(time.time())
    return {
        **binding(payload),
        "operation": operation,
        "aud": "ai-" + operation.lower(),
        "iss": "ccna-node",
        "sub": "ai-python",
        "keyId": "local-v1",
        "iat": now,
        "exp": now + 50,
    }


def sign(claims, *, secret=SECRET, algorithm="HS256", kid="local-v1"):
    return jwt.encode(claims, secret, algorithm=algorithm, headers={"kid": kid})


def headers_for(payload):
    return {
        "Authorization": "Bearer " + sign(claims_for(payload)),
        "X-AI-Claim-Token": sign(claims_for(payload, "CLAIM")),
        "X-AI-Receipt-Token": sign(claims_for(payload, "RECEIPT")),
        "X-AI-Contract-Version": VERSION,
        "Content-Type": "application/json",
    }


@pytest.fixture
def settings():
    return Settings(
        mode="gemini",
        environment="local",
        service_secret=SECRET,
        live_enabled=True,
        api_key="synthetic-test-key",
    )


class NodeStub:
    """Test-only Node substitute; production code never owns permit/receipt state."""

    def __init__(self, payload):
        self.payload = payload
        self.calls = []
        self.receipts = []
        self.claimed = False
        self.override = None

    async def __call__(self, request):
        self.calls.append(request)
        operation = request.url.path.rsplit("/", 1)[1]
        if self.override:
            response = await self.override(operation, request)
            if response is not None:
                return response
        body = json.loads(request.content)
        if operation == "claim":
            validate("ClaimRequest", body)
            if self.claimed:
                return httpx.Response(
                    409,
                    json={
                        "contractVersion": VERSION,
                        "error": {
                            "code": "AI_DISPATCH_ALREADY_CLAIMED",
                            "message": "AI_DISPATCH_ALREADY_CLAIMED",
                        },
                    },
                )
            self.claimed = True
            data = {key: body[key] for key in ["callId", "contextHash", "leaseVersion"]}
            data.update(dispatchAuthorized=True, deadlineAt=self.payload["deadlineAt"])
        else:
            assert self.claimed
            validate("ProviderReceipt", body)
            self.receipts.append(body)
            data = {
                "callId": body["callId"],
                "receiptHash": hashlib.sha256(request.content).hexdigest(),
                "recorded": True,
            }
        return httpx.Response(
            200,
            json={"contractVersion": VERSION, "data": data},
            headers={"X-AI-Contract-Version": VERSION},
        )


@pytest.fixture
def node(payload):
    return NodeStub(payload)
