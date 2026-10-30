import json
import logging

import pytest

from app.timing import measure, trace_request


def test_trace_is_opt_in_and_records_only_binding_and_phase(payload, caplog):
    caplog.set_level(logging.WARNING, logger="ai.timings")
    with trace_request(False, payload), measure("prepare"):
        pass
    assert not caplog.records
    with trace_request(True, {**payload, "secret": "never-log-this-canary"}):
        with measure("prepare"):
            pass
        with pytest.raises(ValueError, match="private-exception-canary"), measure("generate"):
            raise ValueError("private-exception-canary")
        with measure("unknown-phase-containing-secret"):
            pass
    with measure("receipt"):
        pass
    events = [json.loads(record.message) for record in caplog.records]
    assert [event["phase"] for event in events] == ["prepare", "generate"]
    assert [event["outcome"] for event in events] == ["ok", "error"]
    assert all(
        set(event) == {"event", "requestId", "callId", "phase", "ms", "outcome"} for event in events
    )
    assert all(event["requestId"] == payload["requestId"] and event["ms"] >= 0 for event in events)
    assert "canary" not in caplog.text and "secret" not in caplog.text


def test_nested_trace_restores_parent_binding_and_disabled_scope(payload, caplog):
    caplog.set_level(logging.WARNING, logger="ai.timings")
    with trace_request(True, payload):
        with trace_request(False, payload), measure("claim"):
            pass
        with measure("receipt"):
            pass
    assert len(caplog.records) == 1
    assert json.loads(caplog.records[0].message)["phase"] == "receipt"
