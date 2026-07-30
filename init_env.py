"""
Utility script for initializing a local development environment.

This script performs three main setup tasks:

1. Configure Git hooks
- If a `.git` directory is present, the script sets `core.hooksPath` to `.githooks`
    so that custom Git hooks in the repository are automatically used.

2. Upgrade pip and install project dependencies
- Uses `sys.executable` to ensure installation occurs inside the active virtual
    environment.
- Automatically installs packages from `requirements.txt` if it exists.

3. Provide user‑friendly console output
- Prints progress messages and warnings to guide the developer through the setup
    process.

Run this script once after cloning the repository to prepare your local environment.

`python init_env.py`
"""

#!/usr/bin/env python3

import os
import subprocess
import sys


def setup_project() -> None:
    """
    Set up the local development environment for the project.

    This function performs the following actions:

    - Checks for a `.git` directory and configures Git to use the `.githooks`
      directory for custom hooks.
    - Upgrades `pip` using the currently active Python interpreter.
    - Installs dependencies listed in `requirements.txt` if the file exists.
    - Prints status messages to guide the user through the setup process.

    This function is intended to be run once after cloning the repository.
    """

    print("🚀 Setting up local development environment...")

    # 1. Configure Git Hooks
    if os.path.exists(".git"):
        subprocess.run(["git", "config", "core.hooksPath", ".githooks"], check=False)
        print("✅ Git hooks path set to .githooks")
    else:
        print("⚠️ Warning: .git folder not found. Are you in the repo root?")

    # 2. Upgrade pip and install requirements automatically
    # Uses sys.executable to ensure it targets the currently active venv
    print("📦 Installing project dependencies...")
    subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "pip"], check=False)
    if os.path.exists("requirements.txt"):
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], check=False)
        print("✅ Dependencies installed.")

    print("\n🎉 Setup complete! You are ready to develop.")


if __name__ == "__main__":
    setup_project()
