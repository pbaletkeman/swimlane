"""
Application configuration management.

Provides the Config class for loading YAML configuration, setting Google OAuth
environment variables, and selecting the active database provider. All config
reads are cached after the first call to avoid repeated disk I/O.
"""

import json
import os
from typing import Any
import yaml


class Config:
    """
    Methods used for configuration options
    """

    db_provider: dict[Any, Any]
    db: Any | None = None
    _yaml_cache: dict[str, Any] | None = None
    _google_configured: bool = False
    _sqlite_file_cache: str | None = None

    @staticmethod
    def yaml_config() -> dict[str, Any]:
        """Load the config.yaml file (cached after first read)"""
        if Config._yaml_cache is not None:
            return Config._yaml_cache
        config: dict[str, Any] = {}
        with open("config.yaml", "r", encoding="utf-8") as file:
            config = yaml.safe_load(file)
        Config._yaml_cache = config
        return config

    @staticmethod
    def google_config(file_path: str = ".secrets/client_secret.json") -> None:
        """
        Load configuration from a JSON file and set environment variables.
        This is necessary for the OAuth client to access the required credentials.
        Skips if already configured (cached).
        """
        if Config._google_configured:
            return
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                config_data = json.load(file)
                web = config_data.get("web", {})
                for key, value in web.items():
                    os.environ["GOOGLE_" + key.upper()] = str(value)
            Config._google_configured = True
        except FileNotFoundError as exc:
            raise FileNotFoundError(
                f"Google OAuth client secret not found at '{file_path}'. "
                "Create it from client_secret.sample.txt."
            ) from exc
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Invalid JSON in '{file_path}': {exc}"
            ) from exc

    @staticmethod
    def sqlite_file() -> str:
        """Return the SQLite database file path (cached after first read)"""
        if Config._sqlite_file_cache is not None:
            return Config._sqlite_file_cache
        config = Config.yaml_config()
        path = config.get("sql", {}).get("providers", {}).get("sqlite", {}).get("sqlite_file", "")
        Config._sqlite_file_cache = path
        return path


    def __init__(self) -> None:
        from src.data.users.sqlite import SQLite

        self.yamlconfig: dict[str, Any] = Config.yaml_config()
        Config.google_config()
        if self.yamlconfig["sql"]["active"] == "sqlite":
            self.db_provider = self.yamlconfig["sql"]["providers"]["sqlite"]
            self.db = SQLite
        elif self.yamlconfig["sql"]["active"] == "postgresql":
            self.db_provider = self.yamlconfig["sql"]["providers"]["postgresql"]
            raise NotImplementedError("PostgreSQL provider not yet implemented")
        else:
            print("config not found")
