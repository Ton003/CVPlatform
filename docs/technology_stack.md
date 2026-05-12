# 4. TECHNOLOGY STACK ANALYSIS

This analysis details the technologies actually used in the project, verified via `package.json`, `requirements.txt`, and source code imports.

## Core Frameworks
*   **Frontend**: Angular 18 (Standalone Components, RxJS, SCSS).
*   **Backend**: NestJS 10.x (TypeScript, Dependency Injection, Modular architecture).
*   **AI Microservice**: FastAPI 0.111 (Python 3.11+, Pydantic, Uvicorn).

## Data Storage
*   **Primary Database**: PostgreSQL 16.
*   **Vector Extension**: `pgvector` (Used for storing and querying 384-dimensional embeddings).
*   **ORM**: TypeORM 0.3.x (Database schema management and relational queries).

## AI & Machine Learning (The "Intelligence" Layer)
*   **Large Language Model (LLM)**: Groq Cloud API (utilizing `llama-3.3-70b-versatile`).
    *   *Usage*: CV parsing, narrative generation for search results, career development plan generation.
*   **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (Running locally in the Python container).
    *   *Usage*: Converting queries and CV text into vectors for semantic search.
*   **Reranking Model**: `cross-encoder/ms-marco-MiniLM-L-6-v2` (Running locally).
    *   *Usage*: Refining the top candidates to ensure the best matches appear first.
*   **NLP Tools**: Spacy (used for light text preprocessing).

## Communication & Integration
*   **API Protocol**: REST over HTTP.
*   **Security**: JSON Web Tokens (JWT) via `@nestjs/jwt` and `passport-jwt`.
*   **Passwords**: Hashed using `bcrypt` (Salt rounds: 12).
*   **File Handling**: `multer` (backend) for handling PDF uploads; `base64` encoding for service-to-service transfer.

## DevOps & Infrastructure
*   **Orchestration**: Docker & Docker Compose.
*   **Containerization**: 
    *   `biat_postgres`: DB service.
    *   `biat_python`: AI service.
    *   `biat_backend`: Logic service.
    *   `biat_frontend`: UI service.
*   **Frontend Web Server**: Nginx (configured in the production Dockerfile).

## Development Tools
*   **Language**: TypeScript (Backend & Frontend), Python (AI Service).
*   **Linting**: ESLint, Prettier.
*   **Unit Testing**: Jest (backend infrastructure exists, but coverage is currently low).
