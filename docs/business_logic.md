# 8. REAL BUSINESS LOGIC

This document isolates and explains the complex business rules and logic implemented in the BIAT TalentOS codebase.

## 1. Candidate Scoring & Matching
The system implements a multi-factor scoring algorithm to rank candidates for job offers.

### Logic (found in `ApplicationsService`):
*   **Skill Match (50%)**: Calculates the intersection between `job.requiredSkills` and `candidate.technicalSkills`.
*   **Experience Match (30%)**: Compares `candidate.yearsExperience` against `job.minExperience`. A 1:1 match gives full points; being over-qualified gives a slight bonus, under-qualified gives a penalty.
*   **AI Context (20%)**: Uses the LLM summary to detect "hidden" qualifications not explicitly listed in the skills array.

## 2. Manager Data Scoping (ABAC)
The most critical security logic for a multi-tenant or departmental system.

### Rules (found in `PolicyService`):
*   **Access Denial**: If a user has the `manager` role but no linked `employee_id`, all management endpoints return `403 Forbidden`.
*   **The "Hiring Manager" Rule**: A manager can ONLY see applications for a `job_offer` where they are explicitly named in the `hiring_manager` field.
*   **The "Department" Rule**: A manager can see ALL employees in their department (for succession planning) but NONE outside it.

## 3. Career Advancement Logic
How the system determines if an employee is ready for a promotion.

### Readiness Score Calculation:
*   **Core Logic**: Compares the employee's current `competencySnapshot` (JSON) against the `TargetProfile` of the next rank in the `JobRoleLevel` hierarchy.
*   **The "Gap" Detection**: Identifies specific skills where `Actual Level < Target Level`.
*   **Succession Readiness**: A manual override flag (`ready_now`, `ready_1_yr`) that, combined with the gap analysis, determines placement in the Talent Matrix.

## 4. Candidate-to-Employee Conversion (The "Promotion" Workflow)
The bridge between recruitment and HR.

### Steps:
1.  **Validation**: Ensures the application stage is set to `hired`.
2.  **Snapshotting**: Freezes the candidate's skills at the moment of hiring to create the initial `Employee` profile.
3.  **Role Assignment**: Links the new employee to the `job_role` and `job_level` defined in the `job_offer`.
4.  **Audit Trail**: Updates the original `Candidate` record to `converted` to ensure they are removed from active recruitment searches.

## 5. Org Chart Hierarchy Generation
The system builds a recursive tree structure from a flat table.

### Algorithm:
1.  Fetch all employees in the target scope.
2.  Identify "Roots" (Employees where `manager_id` is null).
3.  Recursively find "Children" for each node where `child.manager_id = parent.id`.
4.  Return a nested JSON structure for frontend rendering.
