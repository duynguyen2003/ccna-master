import copy
import json

import pytest
from conftest import CONTRACTS

from app.models import MODELS

CASES = json.loads((CONTRACTS / "fixtures/cases.json").read_text(encoding="utf-8"))["schemaCases"]


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_pydantic_keeps_zod_fixture_parity_without_coercion_or_field_drop(case):
    original = copy.deepcopy(case["value"])
    if case["valid"]:
        parsed = MODELS[case["schema"]].model_validate(case["value"])
        assert parsed.root == original
    else:
        with pytest.raises(ValueError):
            MODELS[case["schema"]].model_validate(case["value"])
    assert case["value"] == original
