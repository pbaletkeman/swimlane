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


def main() -> None:
    """Seed the database with WEB_ADMIN users from config and seed_admins.json.

    For each sub in config.yaml's web_admins:
    - Skips if the user already exists in the database.
    - Looks up name/email from seed_admins.json.
    - Encrypts PII fields and inserts the user with WEB_ADMIN role.
    """
    config = Config.yaml_config()
    web_admins_raw: list[Any] = config.get("security", {}).get("web_admins", [])
    web_admins: list[str] = [str(s) for s in web_admins_raw]

    if not web_admins:
        print("No web_admins found in config.yaml under security.web_admins.")
        sys.exit(1)

    seed_data = _load_seed_data()

    db = SQLite()
    db.init()

    created = 0
    skipped = 0
    errors = 0

    for sub in web_admins:
        existing = db.get_user_by_sub(sub)
        if existing:
            print(f"  SKIP  sub={sub} (already exists)")
            skipped += 1
            continue

        if sub not in seed_data:
            print(f"  ERROR sub={sub} not found in seed_admins.json")
            errors += 1
            continue

        entry = seed_data[sub]
        first_name: str = entry["first_name"]
        last_name: str = entry["last_name"]
        email: str = entry["email"]

        first_enc = encrypt_field(first_name)
        last_enc = encrypt_field(last_name)
        email_enc = encrypt_field(email)

        # hash_field produces a deterministic hash for lookups (email is also encrypted above)
        user = User(
            sub=sub,
            role=UserRole.WEB_ADMIN,
            first_name_nonce=first_enc["nonce"],
            first_name_ciphertext=first_enc["ciphertext"],
            last_name_nonce=last_enc["nonce"],
            last_name_ciphertext=last_enc["ciphertext"],
            email_nonce=email_enc["nonce"],
            email_ciphertext=email_enc["ciphertext"],
            email_hash=hash_field(email),
        )

        result = db.create_user(user)
        if result:
            print(f"  OK    sub={sub} role={result.role}")
            created += 1
        else:
            print(f"  ERROR sub={sub} failed to create")
            errors += 1

    print(f"\nDone. created={created} skipped={skipped} errors={errors}")


if __name__ == "__main__":
    main()
