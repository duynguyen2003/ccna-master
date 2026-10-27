import sys

import uvicorn

from .config import Settings
from .main import create_app


def main():
    try:
        settings = Settings.from_env()
    except (ValueError, TypeError):
        sys.exit("AI_PYTHON_CONFIGURATION_INVALID")
    uvicorn.run(
        create_app(settings),
        host=settings.host,
        port=settings.port,
        access_log=False,
        proxy_headers=False,
        server_header=False,
        timeout_keep_alive=5,
        timeout_graceful_shutdown=10,
    )


if __name__ == "__main__":
    main()
