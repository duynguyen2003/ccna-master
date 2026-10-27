import json
import os
import socket
import subprocess
import sys
import time

import httpx
from conftest import PROJECT, SECRET

from app.boundary import ANALYZE_PATH
from app.contracts import validate


def test_real_python_http_process_with_real_node_jwt_and_callback_peer(payload, tmp_path):
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    env = {key: value for key, value in os.environ.items() if not key.startswith("AI_PYTHON_")}
    env.update(AI_SERVICE_SECRET=SECRET, PY01_TEST_DEADLINE=payload["deadlineAt"])
    # Deliberately unusable proxies: service-to-Node traffic must ignore them.
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        env[key] = "http://127.0.0.1:1"
    env["NO_PROXY"] = ""
    env["no_proxy"] = ""
    peer = subprocess.Popen(
        ["node", str(PROJECT / "tests/fixtures/node-service.cjs"), "serve"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
        creationflags=flags,
    )
    service = None
    try:
        peer_port = json.loads(peer.stdout.readline())["port"]
        tokens = json.loads(
            subprocess.run(
                ["node", str(PROJECT / "tests/fixtures/node-service.cjs"), "sign"],
                input=json.dumps(payload),
                capture_output=True,
                text=True,
                env=env,
                check=True,
            ).stdout
        )
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        env.update(
            AI_PYTHON_MODE="fake",
            AI_PYTHON_ENVIRONMENT="test",
            AI_PYTHON_PORT=str(port),
            AI_PYTHON_NODE_URL=f"http://127.0.0.1:{peer_port}/internal/v1/ai",
        )
        log_file = tmp_path / "service.log"
        with log_file.open("w", encoding="utf-8") as log:
            service = subprocess.Popen(
                [sys.executable, "-m", "app"],
                cwd=PROJECT,
                env=env,
                stdout=log,
                stderr=log,
                creationflags=flags,
            )
            with httpx.Client(trust_env=False, timeout=3) as client:
                for _attempt in range(100):
                    assert service.poll() is None, "Python process stopped before health check"
                    try:
                        if client.get(f"http://127.0.0.1:{port}/health/ready").status_code == 200:
                            break
                    except httpx.ConnectError:
                        pass
                    time.sleep(0.05)
                else:
                    raise AssertionError("Python service never became ready")
                headers = {
                    "Authorization": "Bearer " + tokens["ANALYZE"],
                    "X-AI-Claim-Token": tokens["CLAIM"],
                    "X-AI-Receipt-Token": tokens["RECEIPT"],
                    "X-AI-Contract-Version": "1.0.0",
                }
                response = client.post(
                    f"http://127.0.0.1:{port}" + ANALYZE_PATH, json=payload, headers=headers
                )
                assert response.status_code == 200
                ack = validate("InternalAnalyzeResponse", response.json())
                stats = client.get(f"http://127.0.0.1:{peer_port}/test/stats").json()
                assert stats["claimCount"] == 1 and stats["receiptCount"] == 1
                assert ack["receiptHash"] == stats["receiptHash"]
                assert "output" not in ack
                assert (
                    client.post(
                        f"http://127.0.0.1:{port}" + ANALYZE_PATH, json=payload, headers=headers
                    ).status_code
                    == 409
                )
        text = log_file.read_text(encoding="utf-8")
        assert SECRET not in text and tokens["ANALYZE"] not in text
        assert payload["request"]["message"] not in text
    finally:
        for child in (service, peer):
            if child is not None:
                if os.name == "nt" and child.poll() is None:
                    # The Windows venv launcher can own another Python process.
                    subprocess.run(
                        ["taskkill", "/PID", str(child.pid), "/T", "/F"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=flags,
                        check=False,
                    )
                elif child.poll() is None:
                    child.terminate()
                child.wait(timeout=10)
