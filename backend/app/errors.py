"""Typed error bodies: every failure the client sees is { error: { code, message, recoverable } }."""
from typing import Any, Dict, Optional


class ApiError(Exception):
    """An error with an HTTP status and a body the frontend can show as is."""

    def __init__(self, status: int, code: str, message: str, recoverable: bool):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.recoverable = recoverable

    def body(self, request_id: Optional[str] = None) -> Dict[str, Any]:
        error: Dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "recoverable": self.recoverable,
        }
        if request_id:
            error["requestId"] = request_id
        return {"error": error}


def not_found(what: str, identifier: str) -> ApiError:
    return ApiError(
        404,
        "NOT_FOUND",
        f"{what} {identifier} was not found. Go back to the list and pick another.",
        recoverable=False,
    )


def validation_error(code: str, message: str) -> ApiError:
    """A file or form the service refuses. Fixing the input and trying again can succeed."""
    return ApiError(422, code, message, recoverable=True)


MODEL_FAILURE_MESSAGE = (
    "The detection model stopped before finishing. Try again; if it keeps failing, try another image."
)
