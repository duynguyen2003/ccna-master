"""Test double; not registered by the service launcher."""

from app.contracts import binding, validate
from app.errors import ServiceError

FAKE_VERSIONS = {
    "contextSchemaVersion": "1.0.0",
    "diagnosticVersion": "sim01-r1-v1",
    "promptVersion": "fake-be04",
    "modelVersion": "fake-be04",
    "priceVersion": "fake-zero-v1",
}


class FakeAdapter:
    def accepts(self, payload):
        if payload["providerConfigId"] != "local-gemini-v1" or any(
            payload["versions"].get(key) != value for key, value in FAKE_VERSIONS.items()
        ):
            raise ServiceError("AI_DISABLED")

    async def generate(self, payload):
        self.accepts(payload)
        return validate(
            "ProviderReceipt",
            {
                **binding(payload),
                "outcome": "RECEIVED",
                "providerRequestId": None,
                "usage": {
                    "status": "FINAL",
                    "inputTokens": 0,
                    "outputTokens": 0,
                    "reasoningTokens": 0,
                },
                "versions": payload["versions"],
                "finishReason": "fake",
                "output": {
                    "summary": "Python fake service is connected. No real model analysis was run.",
                    "claimType": "INSUFFICIENT_CONTEXT",
                    "evidenceIds": [],
                    "nextSteps": [],
                    "verification": "Continue checking the lab with the simulator.",
                    "hintLevel": 1,
                },
            },
        )
