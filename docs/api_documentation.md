# 10. API DOCUMENTATION

This is a technical summary of the primary API endpoints implemented in the NestJS backend.

## ── Authentication ─────────────────────────────────────────────────────────

### `POST /auth/signup`
Registers a new user and returns a JWT.
*   **Roles**: Any (default: `hr`).

### `POST /auth/login`
Authenticates user and returns JWT + User profile.

### `GET /auth/profile`
Returns the current authenticated user's data (sanitized).

## ── Candidates ─────────────────────────────────────────────────────────────

### `GET /candidates`
Returns a paginated list of candidates.
*   **Filters**: `search` (name/title), `status`.

### `GET /candidates/:id`
Returns full profile including skills, experience, and education.

### `POST /candidates`
Manual candidate creation.

## ── Recruitment (Job Offers & Applications) ────────────────────────────────

### `GET /job-offers`
Returns all job offers.
*   **Manager Access**: Automatically filtered to only return jobs where `hiring_manager = current_user.employeeId`.

### `POST /job-offers/:id/applications/from-candidate`
Links an existing candidate to a job offer (starts the pipeline).

### `PATCH /applications/:id/stage`
Updates the Kanban stage of an application.
*   **Payload**: `{ "stage": "interview" | "hired" | ... }`

## ── AI & CV Upload ────────────────────────────────────────────────────────

### `POST /cv-upload/upload`
Accepts a PDF file.
1. Extracts text via Python Service.
2. Parses text via Groq LLM.
3. Saves candidate + Parsed data.

### `POST /chatbot/recommend`
The semantic search endpoint.
*   **Payload**: `{ "message": "Search query...", "apiKey": "..." }`
*   **Response**: Narrative answer + Array of candidate matches with scores.

## ── Employees & Org Chart ──────────────────────────────────────────────────

### `GET /employees/org-chart`
Returns the hierarchical tree structure of the company.

### `GET /employees/:id/management-stats`
(Managers only) Returns team size, avg performance, and total tenure for the manager's team.

### `POST /employees/promote`
Converts a hired application into a permanent Employee record.

## ── Infrastructure ───────────────────────────────────────────────────────

### `GET /health` (Python Service)
Checks if the embedding and reranking models are loaded and ready.
