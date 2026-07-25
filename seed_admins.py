"""
Seed the database with WEB_ADMIN users from config.yaml's web_admins list.

Reads subs from config.yaml, name/email from seed_admins.json,
encrypts PII, and inserts into the users table.

Usage:
    python seed_admins.py
"""
import json
import sys
from typing import Any

from src.data.users.user import User
from src.data.users.sqlite import SQLite
from src.encryption import encrypt_field, hash_field
from src.roles.user_role import UserRole
from src.util.configs import Config

REQUIRED_FIELDS = ("first_name", "last_name", "email")


def _load_seed_data(path: str = "seed_admins.json") -> dict[str, dict[str, str]]:
    """Load and validate the seed data JSON file.

    Args:
        path: Path to the JSON file mapping subs to user details.

    Returns:
        Parsed seed data dictionary.

    Raises:
        SystemExit: If the file is missing, malformed, or contains invalid entries.
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            data: dict[str, Any] = json.load(f)
    except FileNotFoundError:
        print(f"Error: {path} not found. Create it with sub-to-user mappings.")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: {path} is not valid JSON: {e}")
        sys.exit(1)

    for sub, entry in data.items():
        if not isinstance(entry, dict):
            print(f"Error: sub={sub} entry is not a dict")
            sys.exit(1)
        missing = [f for f in REQUIRED_FIELDS if f not in entry]
        if missing:
            print(f"Error: sub={sub} is missing required fields: {missing}")
            sys.exit(1)

    return data


def _build_user(sub: str, entry: dict[str, str]) -> User:
    """Build an encrypted User from seed data entry.

    Args:
        sub: The Google subject ID.
        entry: Dictionary with first_name, last_name, email.

    Returns:
        A User with encrypted PII fields and WEB_ADMIN role.
    """
    first_enc = encrypt_field(entry["first_name"])
    last_enc = encrypt_field(entry["last_name"])
    email_enc = encrypt_field(entry["email"])

    return User(
        sub=sub,
        role=UserRole.WEB_ADMIN,
        first_name_nonce=first_enc["nonce"],
        first_name_ciphertext=first_enc["ciphertext"],
        last_name_nonce=last_enc["nonce"],
        last_name_ciphertext=last_enc["ciphertext"],
        email_nonce=email_enc["nonce"],
        email_ciphertext=email_enc["ciphertext"],
        email_hash=hash_field(entry["email"]),
    )


def _seed_one(db: SQLite, sub: str, seed_data: dict[str, dict[str, str]]) -> str:
    """Seed a single admin user. Returns 'created', 'skipped', or 'error'."""
    if db.get_user_by_sub(sub):
        print(f"  SKIP  sub={sub} (already exists)")
        return "skipped"

    if sub not in seed_data:
        print(f"  ERROR sub={sub} not found in seed_admins.json")
        return "error"

    user = db.create_user(_build_user(sub, seed_data[sub]))
    if user:
        print(f"  OK    sub={sub} role={user.role}")
        return "created"

    print(f"  ERROR sub={sub} failed to create")
    return "error"


def main() -> None:
    """Seed the database with WEB_ADMIN users from config and seed_admins.json."""
    config = Config.yaml_config()
    web_admins_raw: list[Any] = config.get("security", {}).get("web_admins", [])
    web_admins: list[str] = [str(s) for s in web_admins_raw]

    if not web_admins:
        print("No web_admins found in config.yaml under security.web_admins.")
        sys.exit(1)

    seed_data = _load_seed_data()
    db = SQLite()
    db.init()

    counts = {"created": 0, "skipped": 0, "error": 0}
    for sub in web_admins:
        counts[_seed_one(db, sub, seed_data)] += 1

    print(f"\nDone. created={counts['created']} skipped={counts['skipped']} errors={counts['error']}")


if __name__ == "__main__":
    main()
