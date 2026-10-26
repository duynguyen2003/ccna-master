"""Validate the same versioned wire examples as Node, without a service or database."""
import json
from pathlib import Path
import sys

from jsonschema import Draft7Validator, FormatChecker


def main():
    root = Path(__file__).resolve().parent
    index = json.loads((root / "schema-index.json").read_text(encoding="utf-8"))
    validators = {}
    for name, relative in index["schemas"].items():
        document = json.loads((root / relative).read_text(encoding="utf-8"))
        Draft7Validator.check_schema(document)
        validators[name] = Draft7Validator(document, format_checker=FormatChecker())
    cases = json.loads((root / "fixtures/cases.json").read_text(encoding="utf-8"))["schemaCases"]
    failures = []
    for case in cases:
        valid = validators[case["schema"]].is_valid(case["value"])
        if valid != case["valid"]:
            failures.append(case["id"])
    if failures:
        print("Python contract mismatches: " + ", ".join(failures), file=sys.stderr)
        return 1
    print(f"Python: {len(cases)} shared fixtures passed across {len(validators)} JSON Schemas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
