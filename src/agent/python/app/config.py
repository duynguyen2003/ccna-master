"""Explicit environment only; provider key is used only in Gemini mode."""

import os
import re
from dataclasses import dataclass, field
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    mode: str = "off"
    host: str = "127.0.0.1"
    port: int = 8001
    environment: str = "local"
    service_secret: str = field(default="", repr=False)
    issuer: str = "ccna-node"
    subject: str = "ai-python"
    key_id: str = "local-v1"
    node_url: str = "http://127.0.0.1:5500/internal/v1/ai"
    max_body_bytes: int = 65536
    body_timeout_ms: int = 2000
    max_request_ms: int = 25000
    callback_timeout_ms: int = 3000
    max_concurrent: int = 2
    receipt_attempts: int = 3
    live_enabled: bool = False
    api_key: str = field(default="", repr=False)

    def __post_init__(self):
        valid = self.mode in {"off", "fake", "gemini"} and self.host in {
            "127.0.0.1",
            "::1",
            "0.0.0.0",
        }
        for name, lower, upper in [
            ("port", 1, 65535),
            ("max_body_bytes", 1, 65536),
            ("body_timeout_ms", 1, 10000),
            ("max_request_ms", 1, 30000),
            ("callback_timeout_ms", 1, 5000),
            ("max_concurrent", 1, 8),
            ("receipt_attempts", 1, 3),
        ]:
            value = getattr(self, name)
            valid = valid and type(value) is int and lower <= value <= upper
        for name in ["issuer", "subject", "key_id"]:
            value = getattr(self, name)
            valid = valid and bool(re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,79}", value))
        if self.service_secret:
            valid = valid and len(self.service_secret) >= 32
            valid = valid and not any(char.isspace() for char in self.service_secret)
        if self.mode in {"fake", "gemini"}:
            valid = valid and self.environment in {"local", "test"} and bool(self.service_secret)
        if self.mode == "gemini":
            valid = valid and self.environment == "local"
        valid = valid and type(self.live_enabled) is bool
        try:
            url = urlsplit(self.node_url)
            valid = valid and (
                not any(ord(char) < 33 or ord(char) == 127 for char in self.node_url)
                and self.node_url == self.node_url.strip()
                and url.scheme in {"http", "https"}
                and url.hostname in {"127.0.0.1", "localhost", "::1"}
                and url.port is not None
                and not url.username
                and not url.password
                and url.path == "/internal/v1/ai"
                and not url.query
                and not url.fragment
            )
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("AI_PYTHON_CONFIGURATION_INVALID")

    @classmethod
    def from_env(cls, environ=None):
        environ = os.environ if environ is None else environ
        fields = {
            "MODE": ("mode", str),
            "HOST": ("host", str),
            "PORT": ("port", int),
            "ENVIRONMENT": ("environment", str),
            "ISSUER": ("issuer", str),
            "SUBJECT": ("subject", str),
            "KEY_ID": ("key_id", str),
            "NODE_URL": ("node_url", str),
            "MAX_BODY_BYTES": ("max_body_bytes", int),
            "BODY_TIMEOUT_MS": ("body_timeout_ms", int),
            "MAX_REQUEST_MS": ("max_request_ms", int),
            "CALLBACK_TIMEOUT_MS": ("callback_timeout_ms", int),
            "MAX_CONCURRENT": ("max_concurrent", int),
            "RECEIPT_ATTEMPTS": ("receipt_attempts", int),
            "LIVE_ENABLED": ("live_enabled", bool),
        }
        values = {
            "service_secret": environ.get("AI_SERVICE_SECRET", ""),
        }
        for key, value in environ.items():
            if not key.startswith("AI_PYTHON_"):
                continue
            entry = fields.get(key.removeprefix("AI_PYTHON_"))
            if entry is None or (entry[1] is int and not re.fullmatch(r"[0-9]+", value)):
                raise ValueError("AI_PYTHON_CONFIGURATION_INVALID")
            if entry[1] is bool:
                if value not in {"true", "false"}:
                    raise ValueError("AI_PYTHON_CONFIGURATION_INVALID")
                values[entry[0]] = value == "true"
            else:
                values[entry[0]] = entry[1](value)
        if values.get("mode") == "gemini":
            values["api_key"] = environ.get("GEMINI_API_KEY", "")
        return cls(**values)
