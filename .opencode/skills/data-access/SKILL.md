---
name: data-access
description: Abstract data interface pattern, SQLite CRUD implementation, and database operations
---

## What this skill covers

The data access layer: abstract interface pattern, SQLite implementation, and database operations for user management.

## Abstract interface pattern

`UserInterface` (`src/data/users/user_interface.py`) is an ABC defining the contract for all user CRUD operations:

**Abstract methods:**
- `init()` -- initialize the data store
- `create_user(user)` -- create a single user
- `update_user(user)` -- update an existing user
- `create_admin_user(user)` -- create a user with admin role if sub is in web_admins list
- `get_user_by_sub(sub)` -- retrieve by Google OAuth subject identifier
- `get_user_by_email(email)` -- retrieve by email address
- `hard_delete_user_by_sub(sub)` -- physical DELETE
- `delete_user_by_sub(sub)` -- soft delete (sets is_deleted, deleted_at)
- `list_users_by_role(role)` -- filter by role
- `list_users()` -- list all users
- `create_users_bulk(users)` -- bulk insert
- `hard_delete_users_bulk(users)` -- bulk physical delete
- `delete_users_bulk(users)` -- bulk soft delete

**Concrete method:**
- `user_exists(sub=, email=)` -- delegates to get methods

## SQLite implementation (`src/data/users/sqlite.py`)

- Raw `sqlite3` stdlib (no ORM)
- Parameterized queries throughout (SQL injection prevention)
- Row-to-model mapper: `create_user_helper()` converts sqlite3 Row dicts to `User` Pydantic models
- Query builder: `get_record_select(where)` builds SELECT with ordering

## Schema

`users` table:
- `id` -- INTEGER PRIMARY KEY AUTOINCREMENT
- `sub` -- TEXT NOT NULL UNIQUE (Google OAuth subject)
- `role` -- TEXT NOT NULL DEFAULT 'USER'
- `first_name_nonce/ciphertext`, `last_name_nonce/ciphertext`, `email_nonce/ciphertext` -- encrypted PII
- `created_at`, `updated_at`, `deleted_at` -- timestamps
- `is_deleted` -- INTEGER DEFAULT 0 (soft delete flag)
- `is_active` -- INTEGER DEFAULT 1

Indexes on: `role`, `sub`, `email_nonce`

## Soft deletes

- `delete_user_by_sub(sub)` -- sets `is_deleted=1`, `deleted_at=CURRENT_TIMESTAMP`
- `hard_delete_user_by_sub(sub)` -- physical `DELETE FROM users`
- Both patterns exist at interface level

## Bulk operations

- `executemany` for inserts
- Parameterized `IN` clauses for batch retrieval
- `LIMIT 20` cap on `create_users_bulk` retrieval

## PostgreSQL (planned)

- Docker Compose setup ready (`config/postgresql/docker-compose.yml`) with PostgreSQL 18 + pgAdmin4
- `Config` class has code path for PostgreSQL provider selection (reads config but no provider class implemented yet)

## Key files

- `src/data/users/user_interface.py` -- abstract base class
- `src/data/users/user.py` -- User Pydantic model
- `src/data/users/sqlite.py` -- SQLite CRUD implementation
- `src/util/configs.py` -- Config class selects database provider

## Known issues

- `_sqlite_file` defaults to empty string in `SQLite.__init__` -- `init()` would fail without config setting it first
- Email lookup by ciphertext is broken due to nonce-dependent encryption (see encryption skill)

## When to use this skill

Use this when modifying database operations, adding new CRUD methods, working with the User model, or switching database providers.
