# 11. EXECUTION FLOW ANALYSIS

This document traces the lifecycle of critical operations within the TalentOS environment.

## 1. Application Startup Flow
1.  **Docker Compose** starts `biat_postgres`.
2.  `biat_python` starts and begins loading the `SentenceTransformer` and `CrossEncoder` models into RAM (this takes ~30-60s).
3.  `biat_backend` starts. On module initialization:
    *   TypeORM connects to Postgres.
    *   `CvSearchService` checks for and enables the `pgvector` extension.
4.  `biat_frontend` (Nginx) starts serving the Angular SPA on Port 80.

## 2. User Authentication Flow (Frontend-to-Backend)
1.  **Frontend**: User enters email/password. `AuthService.login()` sends POST to NestJS.
2.  **NestJS**: `AuthService.login()` validates hash, generates JWT with role.
3.  **Frontend**: Receives JWT, saves to `localStorage`, and pushes user object into `currentUserSubject`.
4.  **Frontend**: `ShellComponent` detects user, fetches navigation items filtered by role.

## 3. The "Semantic Search" Request Cycle
1.  **Action**: User types "Find a Python expert" in the Chatbot.
2.  **Request**: Frontend sends query + Groq API Key to `POST /chatbot/recommend`.
3.  **Step 1 (Embedding)**: NestJS sends query to Python Service `/embed`. Python returns a 384-length array.
4.  **Step 2 (Vector Search)**: NestJS executes raw SQL in Postgres: `embedding <=> [vector]`. Returns top 20 candidate IDs.
5.  **Step 3 (Reranking)**: (If results > 10) NestJS sends query + top candidates to Python `/rerank`. Python returns sorted IDs with relevance scores.
6.  **Step 4 (Narrative)**: NestJS sends query + top 3 candidates to Groq LLM with a prompt: *"Explain why these candidates are good matches."*
7.  **Final**: Frontend receives JSON containing the narrative and the ranked list of candidates.

## 4. CV Processing Pipeline
1.  **Action**: User drops a 5MB PDF into the upload zone.
2.  **Extract**: Frontend sends `FormData` (file) to NestJS. NestJS reads file as buffer, converts to Base64, and sends to Python `/extract`.
3.  **Parse**: NestJS takes the raw text and sends it to Groq LLM with a strict JSON schema prompt.
4.  **Save**: NestJS saves the resulting JSON into the `cv_parsed_data` table and creates a `Candidate` record.
5.  **Clean up**: Temporary file is deleted from the backend server.

## 5. Promotion (Hired to Employee) Flow
1.  **Action**: HR clicks "Promote" on a candidate in the "Hired" stage.
2.  **Transaction**: NestJS starts a database transaction:
    *   Create `Employee` record.
    *   Migrate skills from `cv_parsed_data` to `Employee.competencySnapshot`.
    *   Update `Candidate.status = 'hired'`.
3.  **Sync**: Frontend receives success, navigates to the new Employee profile, and triggers a sidebar refresh.
