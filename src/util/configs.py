
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

    @staticmethod
    def yaml_config() -> dict[str, Any]:
        """Load the config.yaml file"""
        # Open and parse the YAML file
        config: dict[str, Any] = {}
        with open("config.yaml", "r", encoding="utf-8") as file:
            config = yaml.safe_load(file)

        return config

    @staticmethod
    def google_config(file_path: str = ".secrets/client_secret.json") -> None:
        """
        Load configuration from a JSON file and set environment variables.
        This is necessary for the OAuth client to access the required credentials.
        """
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                config_data = json.load(file)
                web = config_data.get("web", {})
                for key, value in web.items():
                    os.environ["GOOGLE_" + key] = str(value)
        except FileNotFoundError:
            print("Configuration file not found. Please ensure .secrets/client_secret.json exists.")
        except json.JSONDecodeError:
            print("Error decoding JSON configuration. Please check the format of client_secret.json.")


    def __init__(self) -> None:
        from src.data.users.sqlite import SQLite

        self.yamlconfig: dict[str, Any] = Config.yaml_config()
        Config.google_config()
        if self.yamlconfig["sql"]["active"] == "sqlite":
            self.db_provider = self.yamlconfig["sql"]["providers"]["sqlite"]
            self.db = SQLite
        elif self.yamlconfig["sql"]["active"] == "postgresql":
            self.db_provider = self.yamlconfig["sql"]["providers"]["postgresql"]
        else:
            print("config not found")
