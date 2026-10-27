import re
import time

import jwt

from .contracts import binding, validate
from .errors import ServiceError


def verify_token(authorization, operation, settings):
    try:
        if len(authorization) > 4096 or not re.fullmatch(r"Bearer [^\s]+", authorization):
            raise ValueError()
        decoded = jwt.decode_complete(
            authorization[7:],
            settings.service_secret,
            algorithms=["HS256"],
            audience=f"ai-{operation.lower()}",
            issuer=settings.issuer,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
        claims = validate("ServiceClaims", decoded["payload"])
        now = time.time()
        if (
            decoded["header"].get("kid") != settings.key_id
            or claims["keyId"] != settings.key_id
            or claims["sub"] != settings.subject
            or claims["operation"] != operation
            or claims["iat"] > now
            or claims["exp"] <= now
            or not 0 < claims["exp"] - claims["iat"] <= 60
        ):
            raise ValueError()
        return claims
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise ServiceError("UNAUTHORIZED") from None


def verify_binding(claims, payload):
    if binding(claims) != binding(payload):
        raise ServiceError("UNAUTHORIZED")
