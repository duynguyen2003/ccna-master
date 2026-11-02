import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from .boundary import ANALYZE_PATH, Boundary
from .callbacks import NodeCallbacks
from .config import Settings
from .contracts import VERSION, binding, validate
from .errors import ServiceError, error_response
from .gemini import GeminiAdapter
from .models import parse_wire
from .timing import measure


def create_app(settings=None, *, transport=None, adapter=None, provider_transport=None):
    settings = settings or Settings.from_env()
    for name in ("httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)

    @asynccontextmanager
    async def lifespan(app):
        async with httpx.AsyncClient(
            transport=transport or httpx.AsyncHTTPTransport(retries=0, trust_env=False),
            follow_redirects=False,
            trust_env=False,
            timeout=settings.callback_timeout_ms / 1000,
            limits=httpx.Limits(max_connections=settings.max_concurrent),
        ) as client:
            async with httpx.AsyncClient(
                transport=provider_transport
                or httpx.AsyncHTTPTransport(retries=0, trust_env=False),
                follow_redirects=False,
                trust_env=False,
                timeout=None,
            ) as provider_client:
                app.state.callbacks = NodeCallbacks(client, settings)
                app.state.adapters = {}
                if settings.mode == "gemini":
                    app.state.adapters["local-gemini-v1"] = adapter or GeminiAdapter(
                        settings, provider_client
                    )
                yield

    app = FastAPI(
        title="AI Lab internal service",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        redirect_slashes=False,
        lifespan=lifespan,
    )
    app.add_middleware(Boundary, settings=settings)

    @app.exception_handler(HTTPException)
    async def http_error(_request, error):
        return error_response(
            "AI_RESOURCE_NOT_FOUND" if error.status_code == 404 else "AI_INVALID_REQUEST"
        )

    @app.get("/health/live")
    async def live():
        return JSONResponse(
            {"service": "ai-python", "status": "live", "contractVersion": VERSION},
            headers={"Cache-Control": "no-store"},
        )

    @app.get("/health/ready")
    async def ready():
        enabled = settings.mode == "gemini" and settings.live_enabled and bool(settings.api_key)
        return JSONResponse(
            {
                "service": "ai-python",
                "status": "ready" if enabled else "disabled",
                "adapter": settings.mode if enabled else None,
                "contractVersion": VERSION,
                "scope": "configuration; execution requires Node permit",
            },
            status_code=200 if enabled else 503,
            headers={"Cache-Control": "no-store"},
        )

    @app.post(ANALYZE_PATH)
    async def analyze(request: Request):
        payload = parse_wire("InternalAnalyzeRequest", request.state.ai_payload)
        tokens = request.state.ai_tokens
        adapter = app.state.adapters.get(payload["providerConfigId"])
        if adapter is None:
            raise ServiceError("AI_DISABLED")
        adapter.accepts(payload)
        claimed = False
        try:
            async with asyncio.timeout_at(request.state.ai_generation_deadline):
                with measure("prepare"):
                    prepared = (
                        await adapter.prepare(payload) if hasattr(adapter, "prepare") else None
                    )
                with measure("claim"):
                    await app.state.callbacks.claim(payload, tokens["claim"])
                claimed = True
                with measure("generate"):
                    receipt = (
                        await adapter.generate(payload, prepared)
                        if prepared is not None
                        else await adapter.generate(payload)
                    )
                with measure("validate_receipt"):
                    parse_wire("ProviderReceipt", receipt)
        except TimeoutError:
            if not claimed:
                raise ServiceError("AI_LEASE_LOST") from None
            receipt = {
                **binding(payload),
                "versions": payload["versions"],
                "providerRequestId": None,
                "outcome": "OUTCOME_UNKNOWN",
                "finishReason": "GENERATION_DEADLINE",
                "usage": {
                    "status": "UNRESOLVED",
                    "inputTokens": None,
                    "outputTokens": None,
                    "reasoningTokens": None,
                },
                "output": None,
            }
        with measure("receipt"):
            receipt_hash = await app.state.callbacks.receipt(receipt, tokens["receipt"])
        ack = validate(
            "InternalAnalyzeResponse",
            {
                "contractVersion": VERSION,
                "callId": payload["callId"],
                "contextHash": payload["contextHash"],
                "receiptHash": receipt_hash,
            },
        )
        return JSONResponse(
            ack,
            headers={"X-AI-Contract-Version": VERSION, "Cache-Control": "private, no-store"},
        )

    return app
