# 1. PROJECT OVERVIEW

**Project Name**: BIAT TalentOS
**Version**: 3.0.0 (Production Candidate)
**Corpus**: IT Recruitment & Talent Management Platform

## Core Purpose
BIAT TalentOS is a comprehensive recruitment and talent management platform designed to automate the transition from external candidate acquisition to internal employee lifecycle management. It leverages AI for CV parsing and semantic search while providing a structured framework for competency tracking and career development.

## User Roles (Implemented)
Based on `backend/src/auth/policy.service.ts` and `frontend/src/app/shared/sidebar/sidebar.component.ts`:

1.  **Administrator (`admin`)**:
    *   Full system access.
    *   Manage job architecture (Business Units, Departments, Titles).
    *   Global visibility of all candidates and employees.
2.  **HR Manager (`hr`)**:
    *   Can post job offers and manage the recruitment pipeline.
    *   Upload and parse CVs.
    *   Manage the Competencies Library.
    *   Access the Talent Matrix (9-Box) for organizational planning.
3.  **Hiring Manager (`manager`)**:
    *   **Scoped Access**: Limited to candidates who applied to jobs they own (where `hiring_manager` matches their `employeeId`).
    *   **Departmental Scope**: Can view employees within their own department.
    *   **Restricted**: Cannot access the global Talent Matrix or the Competencies Library.

## Real Implemented Features

### 1. Recruitment Pipeline
*   **Job Offer Management**: Create, edit, and track job postings linked to specific departments and hiring managers.
*   **Kanban Workflow**: Drag-and-drop pipeline (Applied → Screening → Interview → Assessment → Offer → Hired/Rejected) with backward-move confirmation guards.
*   **AI CV Parsing**: Asynchronous extraction of skills, experience, education, and summaries from PDFs using the Groq (Llama-3) API.
*   **Candidate Matching**: Scoring system based on job requirements vs. candidate extracted skills.

### 2. Talent Intelligence
*   **AI Semantic Search**: Chatbot interface that uses vector embeddings (via a Python microservice) to find candidates based on natural language queries (e.g., "Find a senior React dev in Tunis").
*   **Competency Gap Analysis**: Automatic comparison between an employee's current skills and the requirements of their next rank.
*   **Development Plans**: AI-generated career paths based on detected skill gaps.

### 3. Employee Management
*   **Org Chart**: Interactive visualization of the company hierarchy.
*   **Talent Matrix (9-Box)**: Visual grid mapping employees based on Potential vs. Performance (for HR/Admin only).
*   **Succession Planning**: Identification of "Ready Now" successors within departments for leadership roles.
*   **Candidate Promotion**: One-click conversion of a hired candidate into an employee record, migrating their skill snapshot into the HR database.

## Implementation Status

| Feature | Status | Notes |
| :--- | :--- | :--- |
| JWT Authentication | ✅ Fully Implemented | bcrypt hashing + JWT strategy. |
| RBAC / ABAC Guards | ✅ Fully Implemented | PolicyService enforces manager scoping. |
| CV Upload (PDF) | ✅ Fully Implemented | Base64 transfer to Python service for text extraction. |
| AI Parsing (Groq) | ✅ Fully Implemented | Structured JSON output from Llama-3. |
| Vector Search | ✅ Fully Implemented | pgvector + Python embedding service. |
| Org Chart | ✅ Fully Implemented | Recursive tree structure rendering. |
| Promotion Workflow | ✅ Fully Implemented | Data migration from candidate to employee table. |
| Email Notifications | ❌ Missing | Logic exists in code but no active SMTP config found. |
| Interview Scheduling | ⚠️ Partial | Entities exist, but calendar UI is basic. |
| Real-time Notifications | ❌ Missing | No WebSocket or SSE implementation found. |
