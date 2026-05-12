# 7. FRONTEND ANALYSIS (ANGULAR)

The frontend is built with Angular 18, focusing on a premium, interactive user experience through standalone components and reactive programming.

## Design System: Premium Glassmorphism
The platform implements a custom UI framework defined in `app.scss` and feature-specific stylesheets.
*   **Aesthetics**: High use of `backdrop-filter: blur()`, subtle gradients, and rounded corners (`16px` standard).
*   **Typography**: Uses modern sans-serif fonts (Inter/Roboto) with clear weight distinctions for hierarchy.

## State Management Architecture
The system avoids heavy libraries like NgRx in favor of **Lightweight Reactive Services**:
*   **AuthService**: Uses a `BehaviorSubject<User | null>` to track the current user. Components subscribe to `currentUser$` for real-time UI updates (e.g., hiding/showing the sidebar).
*   **ChatStateService**: Manages the conversation history for the AI Search assistant, ensuring history persists across navigation.

## Key Feature Implementations

### 1. The Kanban Pipeline (`job-pipeline`)
*   **Logic**: Uses native HTML Drag and Drop API.
*   **Safety**: Implements `isBackwardMove` logic. If a user drags a candidate from "Interview" back to "Screening," a confirmation modal is triggered to prevent accidental data regression.
*   **Real-time Update**: Optimistic UI updates (card moves immediately) with a rollback mechanism if the backend PATCH request fails.

### 2. Organizational Intelligence (`employees/org-chart`)
*   **Implementation**: Recursive component rendering. The `OrgChartComponent` receives a tree structure from the backend and renders nodes that can contain nested lists of direct reports.
*   **Visuals**: Uses CSS Flexbox and pseudo-elements (`::before/::after`) to draw connection lines between managers and subordinates.

### 3. Talent Matrix (9-Box Grid)
*   **Logic**: A CSS Grid layout (`3x3`) where employees are dynamically placed based on their `performance` and `potential` scores.
*   **Interactivity**: Each quadrant is a drop zone (inferred/planned) or a clickable filter that highlights specific talent segments (Stars, Core Players, Risks).

## Request Handling & Security
*   **JWT Interceptor**: (Found in `core/interceptors`) Automatically attaches the `Authorization: Bearer <token>` header to every outgoing HTTP request.
*   **Auth Guard**: Protects routes by checking `AuthService.isLoggedIn()` before allowing navigation.
*   **Error Handling**: Integrated `ToastService` provides non-intrusive feedback (Success/Error messages) for all user actions.

## Lazy Loading Performance
The project uses `loadComponent()` in `app.routes.ts` to ensure that heavy features like the Talent Matrix or Org Chart are only downloaded when the user actually navigates to them, keeping the initial load time fast.
