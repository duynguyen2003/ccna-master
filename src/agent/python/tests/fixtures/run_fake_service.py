"""Explicit test process; application entry points cannot select this adapter."""

import sys
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fixtures.fake_adapter import FakeAdapter  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

settings = Settings.from_env()
app = create_app(settings, adapter=FakeAdapter())
uvicorn.run(app, host="127.0.0.1", port=settings.port, access_log=False, proxy_headers=False)
