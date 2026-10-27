from starlette.responses import JSONResponse

from .contracts import ERROR_STATUSES, VERSION


class ServiceError(Exception):
    def __init__(self, code="AI_INTERNAL_ERROR"):
        self.code = code if code in ERROR_STATUSES else "AI_INTERNAL_ERROR"
        super().__init__(self.code)


def error_response(code):
    code = code if code in ERROR_STATUSES else "AI_INTERNAL_ERROR"
    return JSONResponse(
        {"contractVersion": VERSION, "error": {"code": code, "message": code}},
        status_code=ERROR_STATUSES[code],
        headers={"X-AI-Contract-Version": VERSION, "Cache-Control": "private, no-store"},
    )
