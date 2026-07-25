"""
PII encryption utilities using AES-256-GCM.

Provides authenticated encryption for sensitive user fields (name, email) with
random nonces, and deterministic SHA-256 hashing for encrypted field lookups.
"""

import os
import base64
import hashlib
from typing import Any, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from src.env import ENCRYPTION_KEY_ENV_VAR

def load_key_from_env() -> bytes:
    """
    Load the AES encryption key from the environment variable.
    The key must be base64-encoded and 32 bytes (256 bits) when decoded.
    """
    key_b64 = os.environ.get("APP_AES_KEY", ENCRYPTION_KEY_ENV_VAR)
    if not key_b64:
        raise RuntimeError("APP_AES_KEY not set")
    key = base64.b64decode(key_b64)
    if len(key) != 32:  # 256 bits
        raise RuntimeError("APP_AES_KEY must be 32 bytes (base64-encoded)")
    return key

KEY = load_key_from_env()

def encrypt_field(plaintext: str, aad: Optional[bytes] = None) -> dict[Any, Any]:
    """
    Encrypt a single PII field with AES-256-GCM.
    Returns dict with base64 nonce + ciphertext.
    """
    aesgcm = AESGCM(KEY)
    nonce = os.urandom(12)  # 96-bit nonce (standard for GCM)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), aad)

    return {
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
    }


def decrypt_field(nonce_b64: str, ciphertext_b64: str, aad: Optional[bytes] = None) -> str:
    """
    Decrypt a single PII field with AES-256-GCM.
    """
    aesgcm = AESGCM(KEY)
    nonce = base64.b64decode(nonce_b64)
    ciphertext = base64.b64decode(ciphertext_b64)
    plaintext = aesgcm.decrypt(nonce, ciphertext, aad)
    return plaintext.decode("utf-8")


def hash_field(plaintext: str) -> str:
    """
    Produce a deterministic SHA-256 hash of a plaintext value.
    Used for lookups on encrypted fields (e.g., email) where the
    encryption is non-deterministic (random nonce per call).
    """
    return hashlib.sha256(plaintext.lower().encode("utf-8")).hexdigest()
