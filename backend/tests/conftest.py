"""
Pytest Test Fixtures and TestClient Setup
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.department import Department
from app.main import app

# In-memory SQLite for fast, completely isolated tests
TEST_DATABASE_URL = "sqlite:///:memory:"

engine_test = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


@pytest.fixture(scope="function")
def db_session():
    """Creates a fresh in-memory database schema for each test."""
    Base.metadata.create_all(bind=engine_test)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine_test)


@pytest.fixture(scope="function")
def client(db_session):
    """Provides a TestClient using the test database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seed_data(db_session):
    """Seeds test departments and users (Admin and 2 Faculty members)."""
    # 1. Departments
    dept_math = Department(name="Mathematics", description="Math Dept")
    dept_sci = Department(name="Science", description="Science Dept")
    db_session.add_all([dept_math, dept_sci])
    db_session.flush()

    # 2. Admin User
    admin = User(
        name="Principal Shrikant",
        username="admin_test",
        email="admin_test@school.edu",
        hashed_password=get_password_hash("AdminPass123"),
        role=UserRole.ADMIN.value,
        is_active=True
    )

    # 3. Faculty 1 (Math Teacher)
    faculty_math = User(
        name="Prof. Sharma (Math)",
        username="faculty_math",
        email="sharma_math@school.edu",
        hashed_password=get_password_hash("FacultyPass123"),
        role=UserRole.FACULTY.value,
        department_id=dept_math.id,
        subject="Mathematics",
        designation="Senior Teacher",
        is_active=True
    )

    # 4. Faculty 2 (Science Teacher)
    faculty_sci = User(
        name="Prof. Patil (Science)",
        username="faculty_sci",
        email="patil_sci@school.edu",
        hashed_password=get_password_hash("FacultyPass123"),
        role=UserRole.FACULTY.value,
        department_id=dept_sci.id,
        subject="Science",
        designation="Assistant Teacher",
        is_active=True
    )

    # 5. Inactive Faculty
    faculty_inactive = User(
        name="Inactive Teacher",
        username="faculty_inactive",
        email="inactive@school.edu",
        hashed_password=get_password_hash("FacultyPass123"),
        role=UserRole.FACULTY.value,
        is_active=False
    )

    db_session.add_all([admin, faculty_math, faculty_sci, faculty_inactive])
    db_session.commit()

    return {
        "dept_math": dept_math,
        "dept_sci": dept_sci,
        "admin": admin,
        "faculty_math": faculty_math,
        "faculty_sci": faculty_sci,
        "faculty_inactive": faculty_inactive
    }


@pytest.fixture
def admin_headers(seed_data):
    token = create_access_token(
        subject=seed_data["admin"].username,
        role=seed_data["admin"].role,
        user_id=seed_data["admin"].id
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def faculty_math_headers(seed_data):
    token = create_access_token(
        subject=seed_data["faculty_math"].username,
        role=seed_data["faculty_math"].role,
        user_id=seed_data["faculty_math"].id
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def faculty_sci_headers(seed_data):
    token = create_access_token(
        subject=seed_data["faculty_sci"].username,
        role=seed_data["faculty_sci"].role,
        user_id=seed_data["faculty_sci"].id
    )
    return {"Authorization": f"Bearer {token}"}
