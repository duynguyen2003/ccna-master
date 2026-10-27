"""Consume generated schemas as-is; preserve unknown fields until validation."""

import json
from datetime import datetime
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

CONTRACT_DIRECTORY = Path(__file__).resolve().parents[2] / "contracts" / "ai-lab" / "v1"
INDEX = json.loads((CONTRACT_DIRECTORY / "schema-index.json").read_text(encoding="utf-8"))
VERSION = INDEX["contractVersion"]
ERROR_STATUSES = json.loads(
    (CONTRACT_DIRECTORY / "error-statuses.json").read_text(encoding="utf-8")
)
VALIDATORS = {
    name: Draft7Validator(
        json.loads((CONTRACT_DIRECTORY / relative).read_text(encoding="utf-8")),
        format_checker=FormatChecker(),
    )
    for name, relative in INDEX["schemas"].items()
}


def validate(name, value):
    # Do not propagate ValidationError: its message contains the rejected input.
    if not VALIDATORS[name].is_valid(value):
        raise ValueError("AI_INVALID_REQUEST")
    return value


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def binding(value):
    return {
        key: value[key]
        for key in ("contractVersion", "requestId", "callId", "contextHash", "leaseVersion")
    }
