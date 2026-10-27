import json
from pathlib import Path

POLICY = json.loads(
    (Path(__file__).resolve().parents[4] / "docs/ai-lab-assistant/ops/OPS-00-live.json").read_text(
        encoding="utf-8"
    )
)
PROMPT_VERSION = "gemini-r1-v2"

GEMINI_VERSIONS = {
    "contextSchemaVersion": "1.0.0",
    "diagnosticVersion": "sim01-r1-v1",
    "promptVersion": PROMPT_VERSION,
    "modelVersion": POLICY["model"],
    "priceVersion": POLICY["priceVersion"],
}
