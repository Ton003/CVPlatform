# 3. COMPLETE CODEBASE MAP

This map details the purpose and logic of all critical directories and files in the BIAT TalentOS project.

## 📁 Root Directory
*   `docker-compose.yml`: Orchestrates the 4 containers: `postgres`, `python-service`, `backend`, and `frontend`.
*   `.env`: Central environment configuration for all services.

## 📁 /backend (NestJS)
The backend is a modular monolith containing the core business logic.

### /src/applications
*   `application.entity.ts`: Defines the recruitment pipeline stage, candidate link, and job link.
*   `applications.service.ts`: Handles stage transitions (Applied → Hired) and recruitment tracking.

### /src/auth
*   `auth.service.ts`: Core logic for `signup`, `login`, and `getProfile`.
*   `policy.service.ts`: **CRITICAL** logic for Role-Based and Attribute-Based access control (Manager scoping).
*   `jwt.strategy.ts`: Validates incoming JWTs and attaches user context to requests.

### /src/chatbot
*   `chatbot.service.ts`: Orchestrates the AI search pipeline (Embedding → Vector Search → Reranking → Narrative).
*   `cv-search.service.ts`: Contains the raw SQL for `pgvector` similarity queries and filtered candidate retrieval.

### /src/cv-upload
*   `cv-upload.service.ts`: Handles file uploads and coordinates text extraction from the Python service.
*   `ai-cv-parser.service.ts`: **INTELLIGENCE LAYER** that builds prompts for the Groq API to extract structured JSON from raw text.

### /src/employees
*   `employee.entity.ts`: Stores internal staff data, including `isManager` flags, department links, and `successionReadiness`.
*   `employees.service.ts`: Handles employee lifecycle, including management statistics and potential successor identification.

## 📁 /frontend (Angular)
The frontend is a modern SPA with a focus on premium user experience.

### /src/app/core
*   `services/auth.service.ts`: Manages user sessions, JWT storage in `localStorage`, and role-based permissions.
*   `guards/auth.guard.ts`: Protects routes from unauthenticated access.

### /src/app/features
*   `/job-pipeline`: Kanban board for managing candidates. Contains logic for "backward-move" prevention.
*   `/employees`: Modules for the Org Chart, Talent Matrix, and Leadership Profiles.
*   `/chatbot`: The "AI Search" interface for semantic candidate discovery.

### /src/app/shared
*   `/confirm-modal`: Reusable premium modal for critical actions (deleting, moving backwards, etc.).

## 📁 /services (Python)
Specialized AI microservice.

*   `main.py`: FastAPI implementation with endpoints for `/extract` (PDF to text), `/embed` (text to vector), and `/rerank`.
*   `Dockerfile`: Configures the environment to run `sentence-transformers` on CPU.

## 📁 /docs
Contains technical documentation, implementation plans, and PFE defense materials.
