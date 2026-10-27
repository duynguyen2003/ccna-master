import json

import pytest
from conftest import CONTRACTS
from jsonschema import Draft7Validator

from app.contracts import VALIDATORS, validate

CASES = json.loads((CONTRACTS / "fixtures/cases.json").read_text(encoding="utf-8"))["schemaCases"]


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_same_generated_wire_fixtures_as_node(case):
    assert VALIDATORS[case["schema"]].is_valid(case["value"]) is case["valid"]


def test_all_generated_schema_documents_are_valid():
    for validator in VALIDATORS.values():
        Draft7Validator.check_schema(validator.schema)


def test_unknown_fields_are_retained_and_rejected_without_echo(payload):
    payload["context"]["lab"]["hiddenAnswer"] = "private-canary-never-in-error"
    with pytest.raises(ValueError, match="^AI_INVALID_REQUEST$") as caught:
        validate("InternalAnalyzeRequest", payload)
    assert "private-canary" not in str(caught.value)


def test_do_not_coerce_integer_strings(payload):
    payload["leaseVersion"] = "1"
    with pytest.raises(ValueError):
        validate("InternalAnalyzeRequest", payload)
