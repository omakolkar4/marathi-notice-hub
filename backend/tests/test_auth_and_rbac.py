"""
Authentication and Role-Based Access Control (RBAC) Tests
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

import pytest


def test_login_success_with_username(client, seed_data):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin_test", "password": "AdminPass123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "Admin"
    assert data["username"] == "admin_test"


def test_login_success_with_email(client, seed_data):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "sharma_math@school.edu", "password": "FacultyPass123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "Faculty"
    assert data["username"] == "faculty_math"


def test_login_failure_wrong_password(client, seed_data):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin_test", "password": "WrongPassword!"}
    )
    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]


def test_login_failure_inactive_user(client, seed_data):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "faculty_inactive", "password": "FacultyPass123"}
    )
    assert response.status_code == 403
    assert "deactivated" in response.json()["detail"]


def test_read_current_user_profile(client, faculty_math_headers):
    response = client.get("/api/v1/auth/me", headers=faculty_math_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "faculty_math"
    assert data["role"] == "Faculty"
    assert data["subject"] == "Mathematics"


def test_auth_me_unauthorized(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_auth_me_invalid_token(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert response.status_code == 401


def test_admin_creates_faculty_account(client, admin_headers, seed_data):
    payload = {
        "name": "Dr. Kulkarni (History)",
        "username": "kulkarni_hist",
        "email": "kulkarni@school.edu",
        "password": "SecurePassword123",
        "role": "Faculty",
        "department_id": seed_data["dept_math"].id,
        "subject": "History",
        "designation": "Assistant Teacher"
    }
    response = client.post("/api/v1/users", json=payload, headers=admin_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "kulkarni_hist"
    assert data["role"] == "Faculty"
    assert data["is_active"] is True


def test_admin_create_user_duplicate_username(client, admin_headers, seed_data):
    payload = {
        "name": "Duplicate User",
        "username": "faculty_math",  # already exists
        "email": "new_email@school.edu",
        "password": "Password123",
        "role": "Faculty"
    }
    response = client.post("/api/v1/users", json=payload, headers=admin_headers)
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]


def test_faculty_cannot_create_account(client, faculty_math_headers):
    payload = {
        "name": "Unauthorized Attempt",
        "username": "hacker_user",
        "email": "hacker@school.edu",
        "password": "Password123",
        "role": "Admin"
    }
    response = client.post("/api/v1/users", json=payload, headers=faculty_math_headers)
    assert response.status_code == 403
    assert "Administrator privileges required" in response.json()["detail"]


def test_faculty_cannot_list_all_users(client, faculty_math_headers):
    response = client.get("/api/v1/users", headers=faculty_math_headers)
    assert response.status_code == 403


def test_faculty_cannot_view_other_user_profile(client, faculty_math_headers, seed_data):
    other_user_id = seed_data["faculty_sci"].id
    response = client.get(f"/api/v1/users/{other_user_id}", headers=faculty_math_headers)
    assert response.status_code == 403
    assert "only view your own profile" in response.json()["detail"]


def test_admin_deactivate_and_activate_faculty(client, admin_headers, seed_data):
    target_id = seed_data["faculty_math"].id

    # Deactivate
    res_deact = client.put(f"/api/v1/users/{target_id}/deactivate", headers=admin_headers)
    assert res_deact.status_code == 200
    assert res_deact.json()["is_active"] is False

    # Verify cannot login
    res_login = client.post("/api/v1/auth/login", data={"username": "faculty_math", "password": "FacultyPass123"})
    assert res_login.status_code == 403

    # Reactivate
    res_act = client.put(f"/api/v1/users/{target_id}/activate", headers=admin_headers)
    assert res_act.status_code == 200
    assert res_act.json()["is_active"] is True


def test_change_password(client, faculty_math_headers):
    payload = {
        "current_password": "FacultyPass123",
        "new_password": "BrandNewPassword2024"
    }
    response = client.post("/api/v1/auth/change-password", json=payload, headers=faculty_math_headers)
    assert response.status_code == 200
    assert "successfully" in response.json()["message"]

    # Verify login with new password
    res_login = client.post("/api/v1/auth/login", data={"username": "faculty_math", "password": "BrandNewPassword2024"})
    assert res_login.status_code == 200


def test_department_management_rbac(client, admin_headers, faculty_math_headers):
    # Admin creates department
    res_create = client.post(
        "/api/v1/departments",
        json={"name": "Examination Department", "description": "Exam conduction"},
        headers=admin_headers
    )
    assert res_create.status_code == 201
    dept_id = res_create.json()["id"]

    # Faculty can list departments
    res_list = client.get("/api/v1/departments", headers=faculty_math_headers)
    assert res_list.status_code == 200
    names = [d["name"] for d in res_list.json()]
    assert "Examination Department" in names

    # Faculty cannot create department
    res_fac_create = client.post(
        "/api/v1/departments",
        json={"name": "Hacker Dept"},
        headers=faculty_math_headers
    )
    assert res_fac_create.status_code == 403
