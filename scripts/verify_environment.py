"""
Environment and Workspace Verification Script
Marathi Notice Hub (Marathi NLP-Based Intelligent Notice Management System)
"""

import sys
import os
from pathlib import Path


def verify():
    print("=" * 60)
    print("Marathi Notice Hub - Environment Health Check")
    print("Project: Marathi NLP-Based Intelligent Notice Management System")
    print("=" * 60)

    # 1. Interpreter Details
    print(f"[x] Python Version:     {sys.version.split()[0]}")
    print(f"[x] Active Interpreter: {sys.executable}")
    in_venv = sys.prefix != sys.base_prefix
    print(f"[x] In Virtual Env:     {in_venv} ({sys.prefix})")

    # 2. Package Imports
    packages = [
        ("fastapi", "FastAPI", True),
        ("uvicorn", "Uvicorn", True),
        ("pydantic", "Pydantic", True),
        ("numpy", "numpy", True),
        ("sklearn", "scikit-learn", True),
        ("pytest", "pytest", True),
        ("dotenv", "python-dotenv", True),
        ("pandas", "pandas", False),
    ]

    print("\n--- Package Verification ---")
    all_packages_ok = True
    for mod_name, label, required in packages:
        try:
            mod = __import__(mod_name)
            ver = getattr(mod, "__version__", "installed")
            print(f"  [OK] {label:<16}: v{ver}")
        except ImportError as e:
            if required:
                print(f"  [FAIL] {label:<14}: {e}")
                all_packages_ok = False
            else:
                print(f"  [INFO] {label:<14}: Optional (blocked or not installed: {e})")

    # 3. Directory Structure Check
    print("\n--- Directory Structure Verification ---")
    project_root = Path(__file__).resolve().parent.parent
    expected_dirs = [
        "backend/app/api",
        "backend/app/core",
        "backend/app/models",
        "backend/app/schemas",
        "backend/app/services",
        "backend/app/nlp",
        "backend/tests",
        "frontend",
        "data/raw",
        "data/processed",
        "data/sample",
        "docs",
        "scripts",
    ]

    all_dirs_ok = True
    for d in expected_dirs:
        dir_path = project_root / d
        exists = dir_path.is_dir()
        status = "OK" if exists else "MISSING"
        if not exists:
            all_dirs_ok = False
        print(f"  [{status}] {d}")

    # 4. Summary
    print("\n" + "=" * 60)
    if all_packages_ok and all_dirs_ok and in_venv:
        print("[SUCCESS] All environment and workspace checks passed!")
    else:
        print("[WARNING] One or more verification checks failed.")
    print("=" * 60)


if __name__ == "__main__":
    verify()
