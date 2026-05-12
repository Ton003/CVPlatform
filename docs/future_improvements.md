# 14. FUTURE IMPROVEMENTS

Based on the current state of the TalentOS platform, here are the logical next steps for a production-ready evolution.

## 1. Technical Enhancements
*   **Real-time Collaboration**: Implement WebSockets (using NestJS Gateway) to allow multiple HR managers to see candidate movements on the Kanban board in real-time.
*   **Background Jobs**: Integrate `BullMQ` (Redis-based) for CV parsing. Currently, the user waits for the LLM to finish; moving this to a background worker would allow for "Bulk Upload" of hundreds of resumes.
*   **Caching Layer**: Add `Redis` to cache frequent queries (like the Competencies Library or Org Chart) to reduce PostgreSQL load.

## 2. Functional Additions
*   **Automated Interview Scheduling**: Integration with Google Calendar or Outlook API to automatically find free slots for interviews.
*   **Candidate Portal**: A external-facing frontend where candidates can track their application status and update their profiles.
*   **Skill Testing Integration**: Automated coding challenges or personality assessments that feed directly into the `match_score`.

## 3. Advanced AI Features
*   **Knowledge Graph**: Instead of just flat embeddings, build a graph of skills (e.g., knowing "React" implies "JavaScript").
*   **Multi-modal Search**: Ability to search for candidates based on voice queries or images (whiteboard drawings of architecture).
*   **Bias Detection**: Implement a "Blind Recruitment" mode that hides names, gender, and photos during the initial screening to ensure AI-driven fairness.

## 4. Security & Compliance
*   **GDPR Tooling**: Automated "Right to be Forgotten" workflows that fully purge candidate data across both Postgres and the Python embedding service.
*   **Two-Factor Authentication (2FA)**: Implementing TOTP (Google Authenticator) for admin and HR accounts.
