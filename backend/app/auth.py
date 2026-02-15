from jose import jwt, JWTError
from fastapi import Header, HTTPException

from .config import settings


def decode_access_token(authorization: str | None = Header(default=None)) -> dict | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def require_auth(claims: dict | None) -> dict:
    if not claims:
        raise HTTPException(status_code=401, detail="Authentication required")
    return claims
