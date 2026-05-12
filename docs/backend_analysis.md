# 6. BACKEND ANALYSIS (NESTJS)

The backend is built on NestJS 10, utilizing a modular architecture to enforce clear separation of concerns.

## Structural Pattern: Controllers, Services, and Repositories

### 1. Controllers (Traffic Routing)
Handle incoming HTTP requests, validate input via DTOs, and delegate business logic to services.
*   **Example**: `JobOffersController` manages job CRUD and triggers application creation.

### 2. Services (Business Logic)
The "Brain" of the application. Services contain the algorithms and decision-making logic.
*   **Example**: `AiCvParserService` handles the complex logic of building LLM prompts and validating returned JSON structures.

### 3. Repositories / Entities (Data Layer)
Define the schema and handle low-level database operations. The project uses the standard TypeORM repository pattern but falls back to `this.dataSource.query()` for complex vector searches.

## Key Logic Implementations

### Asynchronous AI Pipeline (`chatbot.service.ts`)
The chatbot implementation is a multi-step orchestration:
1.  **Extraction**: Extract keywords and filters from user message.
2.  **Embedding**: Call Python service to get vector representation.
3.  **Vector Search**: Query Postgres for candidates with similar embeddings.
4.  **Reranking**: (Conditional) Use a cross-encoder for higher accuracy.
5.  **Narrative Generation**: Use Groq LLM to explain the match in natural language.

### Role-Based Data Scoping (`policy.service.ts`)
This is a sophisticated implementation of security:
*   **HR/Admin**: All `find()` queries return the full dataset.
*   **Manager**:
    *   `getEmployees()` is automatically filtered by the manager's `departmentId`.
    *   `getApplications()` is filtered by jobs where the manager is the `hiring_manager`.
    *   Unauthorized access attempts throw `ForbiddenException`.

### Candidate Promotion Logic (`employees.service.ts`)
When a candidate is "Hired":
1.  A new `Employee` record is created.
2.  Core data (First Name, Last Name, Email) is copied.
3.  The most recent `CvParsedData` (skills, experience) is converted into an employee skill snapshot.
4.  The original `Candidate` status is updated to `hired` to prevent duplicate recruitment.

## Error Handling & Validation
*   **Global Filters**: The app uses NestJS `ValidationPipe` with `transform: true` to ensure incoming DTOs are correctly typed.
*   **Safe Execution**: Try/Catch blocks around external API calls (Groq, Python Service) ensure that a single service failure does not crash the entire application.
