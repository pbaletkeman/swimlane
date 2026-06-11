
import json
import os


def load_config(file_path: str = ".secrets/client_secret.json") -> None:
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
