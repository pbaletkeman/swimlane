# User Entity

User management with encrypted PII fields and Google OAuth authentication.

## Files

| File | Description |
|------|-------------|
| `user.py` | Pydantic model — `User` with encrypted nonce/ciphertext fields, role, timestamps, soft-delete flags |
| `user_interface.py` | Abstract base class — CRUD methods for user data management |
| `sqlite.py` | SQLite implementation — full CRUD with AES-256-GCM encryption, SHA-256 email hashing, role-based queries |

## Table Schema

`users` table with `id`, `sub` (Google subject ID), `role`, encrypted PII fields (`first_name`, `last_name`, `email`), `email_hash`, timestamps, `is_deleted`, `is_active`.
