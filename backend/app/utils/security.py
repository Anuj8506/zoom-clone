"""Opaque capability secrets are separate from LiveKit JWTs."""

import hashlib
import secrets


def new_secret() -> str:
    return secrets.token_urlsafe(32)


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def matches_secret(value: str, stored_hash: str) -> bool:
    return secrets.compare_digest(hash_secret(value), stored_hash)
