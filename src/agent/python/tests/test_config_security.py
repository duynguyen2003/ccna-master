import dataclasses
import json
import os
import subprocess

import pytest
from conftest import PROJECT, SECRET, claims_for, sign

from app.config import Settings
from app.errors import ServiceError
from app.security import verify_token


def test_defaults_disable_ai_and_do_not_consume_application_or_provider_credentials():
    settings = Settings.from_env(
        {"DATABASE_URL": "private-database", "GEMINI_API_KEY": "private-key"}
    )
    assert settings.mode == "off" and settings.host == "127.0.0.1"
    assert settings.service_secret == ""


@pytest.mark.parametrize(
    "values",
    [
        {"AI_PYTHON_MODE": "live"},
        {"AI_PYTHON_MODE": "fake"},
        {"AI_PYTHON_PORT": "1.5"},
        {"AI_PYTHON_PORT": "65536"},
        {"AI_PYTHON_MAX_BODY_BYTES": "65537"},
        {"AI_PYTHON_MAX_CONCURRENT": "0"},
        {"AI_PYTHON_REQUEST_TIMEOUT": "typo-canary"},
        {"AI_SERVICE_SECRET": "short-secret-canary"},
        {"AI_PYTHON_NODE_URL": "http://example.invalid:5000/internal/v1/ai"},
        {"AI_PYTHON_NODE_URL": "http://user:secret@127.0.0.1:5000/internal/v1/ai"},
        {"AI_PYTHON_NODE_URL": "http://127.0.0.1:5000/other"},
        {"AI_PYTHON_NODE_URL": "http://127.0.0.1:5000/internal/v1/ai?secret=canary"},
        {
            "AI_PYTHON_MODE": "fake",
            "AI_SERVICE_SECRET": SECRET,
            "AI_PYTHON_ENVIRONMENT": "production",
        },
    ],
)
def test_invalid_configuration_fails_with_safe_message(values):
    with pytest.raises(ValueError, match="^AI_PYTHON_CONFIGURATION_INVALID$"):
        Settings.from_env(values)


def test_secret_is_not_in_settings_repr(settings):
    assert SECRET not in repr(settings)
    with pytest.raises(ValueError):
        dataclasses.replace(settings, max_concurrent=True)


@pytest.mark.parametrize(
    "change",
    [
        {"iss": "other-node"},
        {"sub": "other-service"},
        {"aud": "ai-claim"},
        {"operation": "CLAIM"},
        {"keyId": "other-key"},
        {"contractVersion": "2.0.0"},
        {"admin": True},
        {"iat": 9999999999, "exp": 10000000000},
        {"iat": 1, "exp": 2},
        {"exp": 9999999999},
        {"iat": True},
    ],
)
def test_rejects_wrong_or_expired_service_claims(payload, settings, change):
    claims = {**claims_for(payload), **change}
    with pytest.raises(ServiceError, match="^UNAUTHORIZED$"):
        verify_token("Bearer " + sign(claims), "ANALYZE", settings)


@pytest.mark.parametrize(
    "change",
    [
        {"kid": "other-key"},
        {"algorithm": "HS384", "secret": SECRET + "-sha384-test-padding"},
        {"secret": "another-synthetic-secret-at-least-32-characters"},
    ],
)
def test_rejects_wrong_key_or_algorithm(payload, settings, change):
    with pytest.raises(ServiceError):
        verify_token("Bearer " + sign(claims_for(payload), **change), "ANALYZE", settings)


def test_real_node_signer_tokens_are_accepted_in_python(payload, settings):
    result = subprocess.run(
        ["node", str(PROJECT / "tests/fixtures/node-service.cjs"), "sign"],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=True,
        env={**os.environ, "AI_SERVICE_SECRET": SECRET},
    )
    tokens = json.loads(result.stdout)
    for operation in ["ANALYZE", "CLAIM", "RECEIPT"]:
        claims = verify_token("Bearer " + tokens[operation], operation, settings)
        assert claims["callId"] == payload["callId"]
