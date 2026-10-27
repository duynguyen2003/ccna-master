import asyncio
import dataclasses
import json

from conftest import headers_for

from app.boundary import ANALYZE_PATH, Boundary


async def invoke(payload, settings, *, chunks=None, headers=None, receive_delay=0, downstream=None):
    headers = headers_for(payload) if headers is None else headers
    chunks = [json.dumps(payload).encode()] if chunks is None else chunks
    scope = {
        "type": "http",
        "method": "POST",
        "path": ANALYZE_PATH,
        "query_string": b"",
        "headers": [(key.lower().encode(), value.encode()) for key, value in headers.items()],
    }
    sent = []
    reads = 0

    async def receive():
        nonlocal reads
        if receive_delay:
            await asyncio.sleep(receive_delay)
        index = reads
        reads += 1
        if chunks[index] is None:
            return {"type": "http.disconnect"}
        return {"type": "http.request", "body": chunks[index], "more_body": index < len(chunks) - 1}

    async def send(message):
        sent.append(message)

    async def default_downstream(scope, receive, send):
        assert scope["state"]["ai_payload"] == payload
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"{}"})

    boundary = Boundary(downstream or default_downstream, settings)
    await boundary(scope, receive, send)
    assert boundary.active == 0
    return sent[0]["status"], reads


def test_authentication_precedes_stream_reads(payload, settings):
    headers = headers_for(payload)
    headers["Authorization"] = "Bearer invalid"
    status, reads = asyncio.run(invoke(payload, settings, headers=headers, chunks=[b"private"] * 5))
    assert status == 401 and reads == 0


def test_real_chunked_upload_limit_without_content_length(payload, settings):
    settings = dataclasses.replace(settings, max_body_bytes=100)
    status, reads = asyncio.run(invoke(payload, settings, chunks=[b"a" * 70, b"b" * 70, b"c"]))
    assert status == 413 and reads == 2


def test_exact_byte_limit_and_one_byte_over(payload, settings):
    raw = json.dumps(payload).encode()
    assert (
        asyncio.run(invoke(payload, dataclasses.replace(settings, max_body_bytes=len(raw))))[0]
        == 200
    )
    assert (
        asyncio.run(invoke(payload, dataclasses.replace(settings, max_body_bytes=len(raw) - 1)))[0]
        == 413
    )


def test_utf8_bytes_are_counted_instead_of_characters(payload, settings):
    payload["history"] = [{"role": "USER", "text": "\U0001f40d" * 5900, "sourceRevision": None}] * 3
    raw = json.dumps(payload, ensure_ascii=False).encode()
    assert len(raw.decode()) < 65536 < len(raw)
    assert asyncio.run(invoke(payload, settings, chunks=[raw]))[0] == 413


def test_upload_timeout_and_disconnection_release_capacity(payload, settings):
    settings = dataclasses.replace(settings, body_timeout_ms=5)
    assert asyncio.run(invoke(payload, settings, receive_delay=0.03))[0] == 409
    assert asyncio.run(invoke(payload, settings, chunks=[None]))[0] == 400


def test_concurrency_limit_rejects_without_queue_or_body_read(payload, settings):
    async def scenario():
        started = asyncio.Event()
        release = asyncio.Event()
        reads = [0, 0]
        statuses = [None, None]

        async def downstream(scope, receive, send):
            started.set()
            await release.wait()
            await send({"type": "http.response.start", "status": 200, "headers": []})

        boundary = Boundary(downstream, dataclasses.replace(settings, max_concurrent=1))

        async def request(index):
            async def receive():
                reads[index] += 1
                return {"type": "http.request", "body": json.dumps(payload).encode()}

            async def send(message):
                if message["type"] == "http.response.start":
                    statuses[index] = message["status"]

            scope = {
                "type": "http",
                "method": "POST",
                "path": ANALYZE_PATH,
                "headers": [
                    (key.lower().encode(), value.encode())
                    for key, value in headers_for(payload).items()
                ],
            }
            await boundary(scope, receive, send)

        first = asyncio.create_task(request(0))
        await asyncio.wait_for(started.wait(), timeout=1)
        await request(1)
        release.set()
        await first
        assert statuses == [200, 503] and reads == [1, 0] and boundary.active == 0

    asyncio.run(scenario())
