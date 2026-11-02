import asyncio
import json
import time

import httpx

from .contracts import binding
from .errors import ServiceError
from .models import parse_wire
from .policy import GEMINI_VERSIONS, POLICY
from .prompts import build_request, validate_answer
from .timing import emit, measure

ORIGIN = "https://generativelanguage.googleapis.com"


def integer(value):
    return type(value) is int and 0 <= value <= 9007199254740991


def usage_from(body):
    usage = body.get("usageMetadata") or {}
    if not isinstance(usage, dict):
        usage = {}
    source = {
        "inputTokens": usage.get("promptTokenCount"),
        "outputTokens": usage.get("candidatesTokenCount"),
        "reasoningTokens": usage.get("thoughtsTokenCount"),
    }
    total = usage.get("totalTokenCount")
    if (
        source["reasoningTokens"] is None
        and all(integer(source[key]) for key in ["inputTokens", "outputTokens"])
        and integer(total)
        and total == source["inputTokens"] + source["outputTokens"]
    ):
        source["reasoningTokens"] = 0
    final = (
        all(integer(value) for value in source.values())
        and integer(total)
        and sum(source.values()) == total
        and not usage.get("toolUsePromptTokenCount", 0)
    )
    return {
        "status": "FINAL" if final else "UNRESOLVED",
        **{key: value if integer(value) else None for key, value in source.items()},
    }


class GeminiAdapter:
    def __init__(self, settings, client):
        self.settings = settings
        self.client = client

    def accepts(self, payload):
        if (
            not self.settings.live_enabled
            or not self.settings.api_key
            or payload["providerConfigId"] != "local-gemini-v1"
            or any(payload["versions"].get(key) != value for key, value in GEMINI_VERSIONS.items())
            or payload["policy"]["maxInputTokens"] > POLICY["maxInputTokens"]
            or payload["policy"]["maxOutputTokens"] > POLICY["maxTotalOutputTokens"]
            or payload["policy"]["maxReasoningTokens"] > POLICY["maxTotalOutputTokens"]
            or payload["policy"]["maxReasoningTokens"] < payload["policy"]["maxOutputTokens"]
        ):
            raise ServiceError("AI_DISABLED")
        caps = payload["policy"]
        reserve = (
            caps["maxInputTokens"] * POLICY["inputMicroUsdPerMillionTokens"]
            + (caps["maxOutputTokens"] + caps["maxReasoningTokens"])
            * POLICY["outputIncludingThinkingMicroUsdPerMillionTokens"]
            + 999999
        ) // 1000000
        if caps["maxCostMicros"] < reserve:
            raise ServiceError("AI_BUDGET_PAUSED")

    async def post(self, method, value, seconds):
        with measure(f"google.{method}.total"):
            return await self._post(method, value, seconds)

    async def _post(self, method, value, seconds):
        # Native REST only: no SDK automatic continuation, retry or tools.
        started = time.perf_counter()
        async with asyncio.timeout(seconds):
            async with self.client.stream(
                "POST",
                f"{ORIGIN}/v1beta/models/{POLICY['model']}:{method}",
                headers={
                    "x-goog-api-key": self.settings.api_key,
                    "Content-Type": "application/json",
                },
                json=value,
            ) as response:
                emit(f"google.{method}.headers", started)
                body_started = time.perf_counter()
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    raw.extend(chunk)
                    if len(raw) > 65536:
                        raise ValueError("RESPONSE_TOO_LARGE")
                emit(f"google.{method}.body", body_started)
                if response.status_code != 200:
                    return response.status_code, {}
                return 200, json.loads(raw)

    async def prepare(self, payload):
        self.accepts(payload)
        request = build_request(payload)
        try:
            status, count = await self.post(
                "countTokens",
                {"generateContentRequest": {"model": "models/" + POLICY["model"], **request}},
                POLICY["countTimeoutMs"] / 1000,
            )
        except (httpx.HTTPError, TimeoutError, ValueError, TypeError):
            raise ServiceError("AI_INTERNAL_ERROR") from None
        if status != 200:
            raise ServiceError("AI_USER_RATE_LIMITED" if status == 429 else "AI_DISABLED")
        measured = count.get("totalTokens") if isinstance(count, dict) else None
        if (
            not integer(measured)
            or measured < 1
            or measured > payload["policy"]["maxInputTokens"] - 64
        ):
            raise ServiceError("AI_CONTEXT_TOO_LARGE")
        return request

    async def generate(self, payload, prepared=None):
        receipt = {
            **binding(payload),
            "versions": payload["versions"],
            "providerRequestId": None,
            "outcome": "OUTCOME_UNKNOWN",
            "usage": {
                "status": "UNRESOLVED",
                "inputTokens": None,
                "outputTokens": None,
                "reasoningTokens": None,
            },
            "finishReason": "PROVIDER_UNAVAILABLE",
            "output": None,
        }
        try:
            status, body = await self.post(
                "generateContent", prepared, POLICY["generationTimeoutMs"] / 1000
            )
            if status != 200:
                receipt.update(
                    outcome="KNOWN_FAILURE" if 400 <= status < 500 else "OUTCOME_UNKNOWN",
                    finishReason=f"GEMINI_HTTP_{status}",
                )
                return parse_wire("ProviderReceipt", receipt)
            if not isinstance(body, dict):
                raise ValueError("INVALID_PROVIDER_BODY")
            receipt["usage"] = usage_from(body)
            provider_id = body.get("responseId")
            if isinstance(provider_id, str) and 1 <= len(provider_id) <= 200:
                receipt["providerRequestId"] = provider_id
            usage = receipt["usage"]
            exceeded = any(
                usage[key] is not None and usage[key] > payload["policy"][limit]
                for key, limit in [
                    ("inputTokens", "maxInputTokens"),
                    ("outputTokens", "maxOutputTokens"),
                    ("reasoningTokens", "maxReasoningTokens"),
                ]
            )
            exceeded = exceeded or (
                usage["outputTokens"] is not None
                and usage["reasoningTokens"] is not None
                and usage["outputTokens"] + usage["reasoningTokens"]
                > POLICY["maxTotalOutputTokens"]
            )
            if exceeded:
                receipt.update(outcome="KNOWN_FAILURE", finishReason="USAGE_EXCEEDS_RESERVATION")
                return parse_wire("ProviderReceipt", receipt)
            receipt["outcome"] = "KNOWN_FAILURE"
            candidate = (body.get("candidates") or [{}])[0]
            if candidate.get("finishReason") != "STOP":
                receipt["finishReason"] = "INCOMPLETE_OUTPUT"
                return parse_wire("ProviderReceipt", receipt)
            text = "".join(
                part.get("text", "")
                for part in candidate.get("content", {}).get("parts", [])
                if not part.get("thought")
            )
            if self.settings.api_key in text:
                raise ValueError("INVALID_OUTPUT")
            output = validate_answer(payload, json.loads(text))
            receipt.update(outcome="RECEIVED", finishReason="STOP", output=output)
            return parse_wire("ProviderReceipt", receipt)
        except (httpx.HTTPError, TimeoutError, asyncio.CancelledError):
            receipt.update(
                outcome="OUTCOME_UNKNOWN", output=None, finishReason="PROVIDER_TIMEOUT_OR_NETWORK"
            )
        except (ValueError, TypeError, KeyError, IndexError, AttributeError, RecursionError):
            # Preserve measured usage even if JSON/output is unusable.
            receipt.update(outcome="KNOWN_FAILURE", output=None, finishReason="INVALID_OUTPUT")
        return parse_wire("ProviderReceipt", receipt)
