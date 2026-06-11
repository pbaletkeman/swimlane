#!/usr/bin/env python3

import os
import subprocess
import sys


def setup_project() -> None:
    print("🚀 Setting up local development environment...")

    # 1. Configure Git Hooks
    if os.path.exists('.git'):
        subprocess.run(['git', 'config', 'core.hooksPath', '.githooks'], check=False)
        print("✅ Git hooks path set to .githooks")
    else:
        print("⚠️ Warning: .git folder not found. Are you in the repo root?")

    # 2. Upgrade pip and install requirements automatically
    # Uses sys.executable to ensure it targets the currently active venv
    print("📦 Installing project dependencies...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', '--upgrade', 'pip'], check=False)
    if os.path.exists('requirements.txt'):
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], check=False)
        print("✅ Dependencies installed.")

    print("\n🎉 Setup complete! You are ready to develop.")

if __name__ == "__main__":
    setup_project()

# run with
# python init_env.py
