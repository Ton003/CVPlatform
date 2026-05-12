# 9. AUTHENTICATION & SECURITY

This document analyzes the security implementation of the BIAT TalentOS platform.

## 1. Authentication (JWT Implementation)
The system uses a stateless JWT (JSON Web Token) authentication mechanism.

*   **Flow**:
    1.  User submits credentials (`POST /auth/login`).
    2.  Backend validates password using `bcrypt.compare`.
    3.  If valid, a JWT is signed containing: `sub` (User ID), `email`, and `role`.
    4.  Frontend stores this token and sends it in the `Authorization: Bearer <token>` header for subsequent requests.
*   **Token Expiry**: Configured in `AuthModule` (typically 1 hour or 24 hours depending on environment settings).

## 2. Password Security
*   **Hashing**: All passwords are hashed using `bcrypt` with **12 salt rounds**.
*   **Sanitization**: The `AuthService` explicitly removes the `passwordHash` field from any user object before it is returned to the frontend or processed in other services.

## 3. Authorization (RBAC & ABAC)
The project implements a two-layered authorization system.

### Layer 1: RBAC (Role-Based Access Control)
*   **Mechanism**: `@Roles()` decorator + `RolesGuard`.
*   **Roles**: `admin`, `hr`, `manager`.
*   **Usage**: Prevents a `manager` from accessing HR-only endpoints like `/competencies` or `/job-architecture`.

### Layer 2: ABAC (Attribute-Based Access Control)
*   **Mechanism**: Custom `PolicyService` logic.
*   **Attributes Checked**: `hiring_manager` UUID, `department_id` UUID.
*   **Usage**: Ensures that a Manager can only see their own department's data. This is "Horizontal Security" (preventing access to data at the same role level).

## 4. Database Security
*   **SQL Injection Prevention**: All queries use TypeORM's query builder or parameterized raw queries (`$1`, `$2` placeholders).
*   **Vector Search Safety**: Embedding vectors are cast safely to the `vector` type in SQL, preventing malformed vector data from causing crashes.

## 5. Frontend Security
*   **Route Guards**: `AuthGuard` prevents unauthenticated users from entering the Shell layout.
*   **Data Leakage Prevention**: Components only receive "Sanitized" versions of objects (e.g., Candidates without internal HR notes if viewed by a manager).

## 6. Identified Gaps (Honest Assessment)
*   **CSRF Protection**: No explicit CSRF middleware is currently enabled for the REST API.
*   **Rate Limiting**: No `Throttler` module is implemented to prevent brute-force login attempts.
*   **HTTPS**: The current Docker setup uses standard HTTP (Port 80/3000); SSL termination is expected at a reverse proxy level (not yet in the codebase).
