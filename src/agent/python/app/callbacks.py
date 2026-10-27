import asyncio
import json

import httpx

from .contracts import VERSION, binding, timestamp, validate
from .errors import ServiceError


class CallbackFailure(ServiceError):
    def __init__(self):
        super().__init__("AI_INTERNAL_ERROR")


class NodeCallbacks:
    def __init__(self, client, settings):
        self.client = client
        self.settings = settings

    async def send(self, operation, payload, token, schema):
        method = "POST" if operation == "claim" else "PUT"
        url = f"{self.settings.node_url}/provider-calls/{payload['callId']}/{operation}"
        try:
            # No redirects, environment proxies, transport retries or dynamic URLs.
            async with asyncio.timeout(self.settings.callback_timeout_ms / 1000):
                async with self.client.stream(
                    method,
                    url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "X-AI-Contract-Version": VERSION,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                ) as response:
                    if 300 <= response.status_code < 400:
                        raise ServiceError()
                    raw = bytearray()
                    async for chunk in response.aiter_bytes():
                        raw.extend(chunk)
                        if len(raw) > 65536:
                            raise ServiceError()
                    value = json.loads(raw)
                    if response.status_code != 200:
                        if response.status_code >= 500:
                            raise CallbackFailure()
                        validate("ErrorResponse", value)
                        raise ServiceError(value["error"]["code"])
                    if response.headers.get("X-AI-Contract-Version") != VERSION:
                        raise ServiceError()
                    return validate(schema, value)
        except ServiceError:
            raise
        except (httpx.HTTPError, TimeoutError, ValueError, TypeError, RecursionError):
            raise CallbackFailure() from None

    async def claim(self, payload, token):
        value = (await self.send("claim", binding(payload), token, "ClaimResponse"))["data"]
        if (
            value["callId"] != payload["callId"]
            or value["contextHash"] != payload["contextHash"]
            or value["leaseVersion"] != payload["leaseVersion"]
            or timestamp(value["deadlineAt"]) != timestamp(payload["deadlineAt"])
        ):
            raise ServiceError()

    async def receipt(self, payload, token):
        # Replay only the immutable receipt. Never repeat analyze/claim/model.
        for attempt in range(self.settings.receipt_attempts):
            try:
                value = (await self.send("receipt", payload, token, "ReceiptResponse"))["data"]
                if value["callId"] != payload["callId"]:
                    raise ServiceError()
                return value["receiptHash"]
            except CallbackFailure:
                if attempt + 1 == self.settings.receipt_attempts:
                    raise
                await asyncio.sleep(0.05 * (2**attempt))
