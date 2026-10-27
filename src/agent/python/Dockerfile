FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.22 /uv /usr/local/bin/uv
WORKDIR /app/src/agent/python
ENV UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    AI_PYTHON_HOST=0.0.0.0 \
    AI_PYTHON_MODE=off

COPY src/agent/python/pyproject.toml src/agent/python/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src/agent/python/app ./app
COPY src/agent/contracts/ai-lab/v1 /app/src/agent/contracts/ai-lab/v1
COPY docs/ai-lab-assistant/ops/OPS-00-live.json /app/docs/ai-lab-assistant/ops/OPS-00-live.json

USER 10001:10001
EXPOSE 8001
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('AI_PYTHON_PORT', '8001') + '/health/live', timeout=2)"]
CMD ["python", "-m", "app"]
