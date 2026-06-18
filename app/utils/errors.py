from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
import logging

logger = logging.getLogger("uam-errors")

async def db_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("Database error occurred")
    # Clean message (strip raw query info to avoid leaking schema internals)
    msg = str(exc)
    if hasattr(exc, "orig") and exc.orig:
        msg = str(exc.orig)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "DatabaseError",
            "detail": "A database integrity or execution error occurred.",
            "message": msg
        }
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("Validation error on path %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "ValidationError",
            "detail": "Request body or query parameter validation failed.",
            "issues": exc.errors()
        }
    )

async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception occurred")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "detail": "An unexpected error occurred on the server.",
            "message": str(exc)
        }
    )
