"""
Initial Admin Provisioning and Seed Script
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

import sys
import argparse
from pathlib import Path

# Add backend directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.department import Department


DEFAULT_DEPARTMENTS = [
    ("Mathematics", "Department of Mathematics and Statistics"),
    ("Science", "Department of Physics, Chemistry, Biology and General Science"),
    ("Languages", "Department of Marathi, Hindi, English and Sanskrit"),
    ("Social Sciences", "Department of History, Geography and Civics"),
    ("Examination", "Examination Planning, Conduct and Evaluation Department"),
    ("Sports & Physical Ed", "Sports Facilities, Physical Training and Tournaments"),
    ("Library", "School Central Library and Learning Resource Center"),
    ("Administration", "General Administration, Accounts, Attendance and Registry"),
]


def seed_departments(db):
    """Seeds standard school departments if they do not already exist."""
    print("\n--- Checking School Departments ---")
    created_count = 0
    for name, desc in DEFAULT_DEPARTMENTS:
        existing = db.query(Department).filter(Department.name == name).first()
        if not existing:
            dept = Department(name=name, description=desc)
            db.add(dept)
            created_count += 1
            print(f"  [+] Created department: {name}")
        else:
            print(f"  [.] Department already exists: {name}")

    if created_count > 0:
        db.commit()
        print(f"[OK] Seeded {created_count} default departments.")
    else:
        print("[OK] All default departments already present.")


def create_admin(name: str, username: str, email: str, password: str, seed_depts: bool = True):
    db = SessionLocal()
    try:
        print("=" * 65)
        print("Marathi Notice Hub - Secure Administrator Provisioning")
        print("Project: Marathi NLP-Based Intelligent Notice Management System")
        print("=" * 65)

        if seed_depts:
            seed_departments(db)

        # Check if username or email exists
        existing_user = db.query(User).filter(
            (User.username == username.strip()) | (User.email == email.strip().lower())
        ).first()

        if existing_user:
            print(f"\n[WARNING] An account with username '{existing_user.username}' or email '{existing_user.email}' already exists.")
            print(f"Role: {existing_user.role} | Active: {existing_user.is_active}")
            return existing_user

        admin_user = User(
            name=name.strip(),
            username=username.strip(),
            email=email.strip().lower(),
            hashed_password=get_password_hash(password),
            role=UserRole.ADMIN.value,
            designation="Principal / Headmaster",
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print("\n[SUCCESS] Initial Admin account created successfully!")
        print(f"  ID:          {admin_user.id}")
        print(f"  Name:        {admin_user.name}")
        print(f"  Username:    {admin_user.username}")
        print(f"  Email:       {admin_user.email}")
        print(f"  Role:        {admin_user.role}")
        print(f"  Designation: {admin_user.designation}")
        print("=" * 65)
        return admin_user

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Create initial authorized Admin account for Marathi Notice Hub")
    parser.add_argument("--name", default="Principal Dr. S. K. Deshmukh", help="Admin Full Name")
    parser.add_argument("--username", default="admin", help="Admin Username")
    parser.add_argument("--email", default="admin@marathinoticehub.edu", help="Admin Email")
    parser.add_argument("--password", default="AdminNotice@2024", help="Admin Password")
    parser.add_argument("--no-seed", action="store_true", help="Do not seed default departments")

    args = parser.parse_args()
    create_admin(
        name=args.name,
        username=args.username,
        email=args.email,
        password=args.password,
        seed_depts=not args.no_seed
    )


if __name__ == "__main__":
    main()
