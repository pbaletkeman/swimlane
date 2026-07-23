---
name: encryption
description: AES-256-GCM authenticated encryption for PII fields (name, email)
---

## What this skill covers

AES-256-GCM encryption of Personally Identifiable Information (PII) fields -- names and emails are never stored in plaintext.

## Algorithm

- AES-256-GCM via the `cryptography` library (`AESGCM` primitive)
- 256-bit key (32 bytes)
- 96-bit (12-byte) random nonce per encryption via `os.urandom(12)`
- Optional AAD (Additional Authenticated Data) parameter -- present but unused in current callers

## Key management

- Primary: `APP_AES_KEY` environment variable (base64-encoded, 32 bytes when decoded)
- Fallback: hardcoded constant `ENCRYPTION_KEY_ENV_VAR` in `src/env.py`
- Key loaded once at module import time as module-level constant `KEY`

## Storage pattern

Each PII field stored as two columns in the database:

- `*_nonce` -- base64-encoded random nonce (unique per encryption)
- `*_ciphertext` -- base64-encoded encrypted data

Encrypted fields: `first_name`, `last_name`, `email`

## User model representation

```python
class User(BaseModel):
    sub: str
    role: str | None
    first_name_nonce: str
    first_name_ciphertext: str
    last_name_nonce: str
    last_name_ciphertext: str
    email_nonce: str
    email_ciphertext: str
    # ... timestamps and flags
```

## Key files

- `src/encryption.py` -- `encrypt_field()` and `decrypt_field()` functions
- `src/env.py` -- `ENCRYPTION_KEY_ENV_VAR` constant (fallback key)
- `src/data/users/user.py` -- User model with nonce/ciphertext field pairs

## Known issues

- `get_user_by_email()` in SQLite queries by `email_ciphertext`, but encryption produces a random nonce each time -- the same email encrypted twice produces different ciphertext, so email lookup by ciphertext will fail for existing users
- If `APP_AES_KEY` env var is not set, all deployments use the same hardcoded fallback key

## When to use this skill

Use this when working with PII storage, modifying the User model, changing encryption logic, or debugging email/name lookup issues.
