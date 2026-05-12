# 13. PFE JURY PREPARATION

This document prepares you for technical questioning by the university jury, based strictly on your project's implementation.

## 🧠 Common Technical Questions & Answers

### Q1: "Why did you choose pgvector instead of a dedicated Vector DB like Pinecone or Weaviate?"
**Answer**: "I chose `pgvector` to maintain **Data Consistency**. By keeping our relational data (candidates, jobs) and our vector embeddings in the same PostgreSQL instance, we avoid the 'split-brain' problem. We can perform joins between metadata and vectors in a single ACID-compliant transaction, which simplifies the architecture and reduces infrastructure costs."

### Q2: "How do you ensure that a Manager doesn't see candidates from another department?"
**Answer**: "Security is implemented using **Attribute-Based Access Control (ABAC)**. In the `PolicyService`, we use the `employeeId` and `departmentId` stored in the user's JWT to automatically filter SQL queries. Even if a manager manually types a candidate ID in the URL, the service layer performs an assertion check against the database to ensure that candidate is linked to a job owned by that manager before returning any data."

### Q3: "What is the difference between your local embedding model and the Groq LLM?"
**Answer**: "They serve different purposes in the **RAG (Retrieval-Augmented Generation)** pipeline. 
1. The **local model** (`all-MiniLM-L6-v2`) is a 'Bi-Encoder' used for fast retrieval of the top 30 matches.
2. The **Groq LLM** (`Llama-3`) is used for 'Reasoning.' It takes those top matches and generates a human-readable explanation of why they match, which is a computationally heavy task better suited for a high-performance cloud API."

### Q4: "How does your CV parser handle unstructured data like PDFs?"
**Answer**: "It's a two-stage process. First, we use `pdfplumber` in our Python service to extract raw text coordinates and strings. Then, we pass that raw text to a Large Language Model with a **System Prompt** that enforces a strict JSON schema. This allows us to convert messy, multi-column resumes into structured data (Skills, Education, Experience) with high accuracy."

### Q5: "If the Groq API goes down, is your application still functional?"
**Answer**: "Yes, the core application remains functional. We use **Graceful Degradation**. While AI-powered parsing and the chatbot narrative would be disabled, users can still manually create candidates, move them through the Kanban pipeline, and perform keyword-based searches using standard SQL."

---

## 💡 Pro-Tips for the Demo
1.  **Start with the Org Chart**: It's a great visual "hook" that shows you've mastered recursive data structures.
2.  **Show the Chatbot**: Demonstrate a complex query (e.g., "Find someone with 5 years experience who knows both Python and AWS"). This proves your semantic search is real.
3.  **The 'Hired' Moment**: Show a candidate being promoted to an employee. Explain how the data migrates between tables. This shows the full business lifecycle.
