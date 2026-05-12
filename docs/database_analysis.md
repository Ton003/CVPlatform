# 5. DATABASE ANALYSIS

This document provides a detailed breakdown of the PostgreSQL schema managed via TypeORM.

## Core Entities

### 1. Candidates (`candidates`)
Stores external talent profiles.
*   **Key Fields**: `id` (UUID), `first_name`, `last_name`, `email` (Unique), `current_title`, `years_experience`, `location`, `status` (active/converted/hired).
*   **Relations**: 
    *   `OneToMany` with `Application`.
    *   `OneToMany` with `CandidateCompetency`.

### 2. Job Offers (`job_offers`)
Stores internal vacancies.
*   **Key Fields**: `id`, `title`, `description`, `location`, `status` (Open/Closed/Draft), `hiring_manager` (UUID - links to `Employee`).
*   **Relations**:
    *   `ManyToOne` with `Department`.
    *   `OneToMany` with `Application`.

### 3. Applications (`applications`)
The join table representing the recruitment pipeline.
*   **Key Fields**: `job_id`, `candidate_id`, `stage` (Kanban state), `match_score`, `competency_gap` (JSONB).
*   **Constraints**: `Unique(['job_id', 'candidate_id'])` — a candidate cannot apply twice to the same job.

### 4. Employees (`employees`)
Stores internal staff data.
*   **Key Fields**: `id`, `first_name`, `last_name`, `is_manager` (Boolean), `department_id`, `job_role_id`, `succession_readiness`, `retention_risk`.
*   **Relations**:
    *   `ManyToOne` with `Employee` (Self-referential `manager_id` for org chart).
    *   `ManyToOne` with `JobRoleLevel` (Career rank).

### 5. CV Parsed Data (`cv_parsed_data`)
Stores extracted intelligence from CVs.
*   **Key Fields**: `cv_id`, `raw_text`, `skills_technical` (JSONB), `llm_summary`, `embedding` (TEXT - cast to `vector` in SQL).

## Advanced Database Features

### Vector Similarity Search (pgvector)
The platform uses the `<=>` (cosine distance) operator to find the shortest distance between a query embedding and candidate embeddings.
*   **Query Example** (from `cv-search.service.ts`):
    ```sql
    SELECT c.id, (1 - (cpd.embedding::vector <=> $1::vector)) AS similarity
    FROM candidates c
    JOIN cv_parsed_data cpd ON cpd.cv_id = c.id::text
    WHERE cpd.embedding IS NOT NULL
    ORDER BY similarity DESC LIMIT 30;
    ```

### JSONB Storage
The platform heavily uses PostgreSQL's `JSONB` type for unstructured or dynamic data:
*   **Skills**: Stored as arrays of strings in `cv_parsed_data`.
*   **Competency Snapshots**: Stored as key-value pairs in `employees` to allow for historical skill tracking without complex joins.

## Relationship Mapping (Summary)
*   **Business Architecture**: `BusinessUnit` (1) → (N) `Department` (1) → (N) `Employee`.
*   **Hiring Architecture**: `JobOffer` (1) → (N) `Application` (N) ← (1) `Candidate`.
*   **Management Hierarchy**: `Employee` (Manager) → (N) `Employee` (Direct Reports).
