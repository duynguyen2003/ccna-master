"""Authenticate before reading input; bound ASGI streaming, time and concurrency."""

import asyncio
import json
import logging
import time

from .contracts import VERSION, timestamp, validate
from .errors import ServiceError, error_response
from .security import verify_binding, verify_token
from .timing import trace_request

ANALYZE_PATH = "/internal/v1/lab-assistant/analyze"
LOGGER = logging.getLogger("ai_service")


def strict_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError()
        value[key] = item
    return value


def reject_constant(_value):
    raise ValueError()


class Boundary:
    def __init__(self, app, settings):
        self.app = app
        self.settings = settings
        self.active = 0

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        if scope["path"] != ANALYZE_PATH:
            await self.app(scope, receive, send)
            return
        counted = False
        started = False

        async def safe_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            if self.settings.mode == "off":
                raise ServiceError("AI_DISABLED")
            if scope["method"] != "POST" or scope.get("query_string"):
                raise ServiceError("AI_INVALID_REQUEST")
            pairs = scope["headers"]
            if sum(len(key) + len(value) for key, value in pairs) > 16384:
                raise ServiceError("AI_CONTEXT_TOO_LARGE")
            headers = {}
            for key, value in pairs:
                name = key.lower()
                if name in headers:
                    raise ServiceError("AI_INVALID_REQUEST")
                headers[name] = value.decode("latin-1")
            authorization = headers.get(b"authorization", "")
            tokens = {
                "analyze": authorization,
                "claim": "Bearer " + headers.get(b"x-ai-claim-token", ""),
                "receipt": "Bearer " + headers.get(b"x-ai-receipt-token", ""),
            }
            claims = {
                operation: verify_token(token, operation.upper(), self.settings)
                for operation, token in tokens.items()
            }
            if headers.get(b"x-ai-contract-version") != VERSION:
                raise ServiceError("AI_INVALID_REQUEST")
            if (
                headers.get(b"content-type", "").lower()
                not in {"application/json", "application/json; charset=utf-8"}
                or headers.get(b"content-encoding", "identity") != "identity"
            ):
                raise ServiceError("AI_INVALID_REQUEST")
            length = headers.get(b"content-length")
            if length is not None and (not length.isascii() or not length.isdecimal()):
                raise ServiceError("AI_INVALID_REQUEST")
            if length is not None and len(length) > 10:
                raise ServiceError("AI_CONTEXT_TOO_LARGE")
            if length is not None and int(length) > self.settings.max_body_bytes:
                raise ServiceError("AI_CONTEXT_TOO_LARGE")
            if self.active >= self.settings.max_concurrent:
                raise ServiceError("AI_CAPACITY_EXHAUSTED")
            self.active += 1
            counted = True
            # Upload time also consumes the authenticated request's total budget.
            started_at = time.monotonic()
            budget = min(
                self.settings.max_request_ms / 1000,
                min(claim["exp"] for claim in claims.values()) - time.time(),
            )
            async with asyncio.timeout(min(budget, self.settings.body_timeout_ms / 1000)):
                raw = bytearray()
                for _chunk in range(1024):
                    message = await receive()
                    if message["type"] != "http.request":
                        raise ServiceError("AI_INVALID_REQUEST")
                    raw.extend(message.get("body", b""))
                    if len(raw) > self.settings.max_body_bytes:
                        raise ServiceError("AI_CONTEXT_TOO_LARGE")
                    if not message.get("more_body", False):
                        break
                else:
                    raise ServiceError("AI_CONTEXT_TOO_LARGE")
            if length is not None and int(length) != len(raw):
                raise ServiceError("AI_INVALID_REQUEST")
            try:
                payload = json.loads(
                    raw.decode("utf-8"),
                    object_pairs_hook=strict_object,
                    parse_constant=reject_constant,
                )
                validate("InternalAnalyzeRequest", payload)
                deadline = timestamp(payload["deadlineAt"])
            except (ValueError, TypeError, KeyError, RecursionError):
                raise ServiceError("AI_INVALID_REQUEST") from None
            for claim in claims.values():
                verify_binding(claim, payload)
            remaining = min(
                budget - (time.monotonic() - started_at),
                deadline - time.time(),
            )
            if remaining <= 0:
                raise ServiceError("AI_LEASE_LOST")
            scope.setdefault("state", {}).update(
                ai_payload=payload,
                ai_tokens={key: value.removeprefix("Bearer ") for key, value in tokens.items()},
                ai_generation_deadline=time.monotonic() + remaining,
                ai_receipt_deadline=min(
                    time.monotonic() + remaining + 4.5,
                    time.monotonic() + claims["receipt"]["exp"] - time.time(),
                ),
            )
            with trace_request(self.settings.trace_timings, payload):
                async with asyncio.timeout_at(scope["state"]["ai_receipt_deadline"]):
                    await self.app(scope, receive, safe_send)
        except ServiceError as error:
            if not started:
                await error_response(error.code)(scope, receive, send)
        except TimeoutError:
            if not started:
                await error_response("AI_LEASE_LOST")(scope, receive, send)
        except Exception:
            # Never log exception messages, tokens, questions, config or payloads.
            LOGGER.warning("ai_request_failed")
            if not started:
                await error_response("AI_INTERNAL_ERROR")(scope, receive, send)
        finally:
            if counted:
                self.active -= 1
