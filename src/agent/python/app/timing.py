"""Opt-in phase timings. Never records content, URLs, credentials or exceptions."""

import json
import logging
import time
from contextlib import contextmanager
from contextvars import ContextVar

_binding = ContextVar("ai_timing_binding", default=None)
_logger = logging.getLogger("ai.timings")
_phases = {
    "prepare",
    "claim",
    "generate",
    "validate_receipt",
    "receipt",
    "google.countTokens.headers",
    "google.countTokens.body",
    "google.countTokens.total",
    "google.generateContent.headers",
    "google.generateContent.body",
    "google.generateContent.total",
}


@contextmanager
def trace_request(enabled, payload):
    token = _binding.set(
        {"requestId": payload["requestId"], "callId": payload["callId"]} if enabled else None
    )
    try:
        yield
    finally:
        _binding.reset(token)


def emit(phase, started, outcome="ok"):
    binding = _binding.get()
    if binding is None or phase not in _phases:
        return
    # Diagnostic logging must never turn a valid provider receipt into a failure.
    try:
        _logger.warning(
            json.dumps(
                {
                    "event": "ai.timing",
                    **binding,
                    "phase": phase,
                    "ms": round((time.perf_counter() - started) * 1000, 3),
                    "outcome": "ok" if outcome == "ok" else "error",
                },
                separators=(",", ":"),
            )
        )
    except Exception:
        pass


@contextmanager
def measure(phase):
    started = time.perf_counter()
    outcome = "error"
    try:
        yield
        outcome = "ok"
    finally:
        emit(phase, started, outcome)
