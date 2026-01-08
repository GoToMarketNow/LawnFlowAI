# LawnFlow.AI QA Test Plan

## 1. Overview
This test plan defines the End-to-End (E2E) testing strategy for the LawnFlow.AI platform. It utilizes **Playwright** to simulate real user interactions across three distinct personas: **Owner/Admin**, **Crew Leader**, and **Crew Member**.

## 2. Test Environment
- **Framework**: Playwright
- **Mode**: Mock Mode (`VITE_USE_MOCKS=true`)
- **Base URL**: `http://localhost:5173` (Vite default)
- **Browser Support**: Chromium, Firefox, WebKit

## 3. Persona Definitions & Scope

### A. Owner/Admin ("The Orchestrator")
**Goal**: Validate high-level operational control, decision making, and system observability.
- **Critical Paths**:
  - Dashboard KPI visibility (ROI, Active Workflows).
  - Work Queue management (Lead -> Quote -> Schedule).
  - Approval workflows (Human-in-the-loop interventions).
  - Agent monitoring (Status checks).

### B. Crew Leader ("The Field Commander")
**Goal**: Validate field execution, route management, and team communication.
- **Critical Paths**:
  - "Today Plan" visibility (Route order).
  - Job execution (Start/Complete jobs).
  - Crew readiness checks.

### C. Crew Member ("The Executor")
**Goal**: Validate clarity of instructions and situational awareness.
- **Critical Paths**:
  - Read-only view of "Today Plan".
  - Notification reception.
  - Job details access (Scope/Notes).

## 4. Test Suites

| ID | Persona | Scenario | Expected Outcome |
|----|---------|----------|------------------|
| **OA-01** | Owner | Dashboard Load | KPIs (ROI, Leads) render with positive trends. |
| **OA-02** | Owner | Workflow Viz | Active workflows (e.g., "Inbound Lead") are visible. |
| **OA-03** | Owner | Pending Actions | "Approve Quote" action is clickable and resolves. |
| **OA-04** | Owner | Agent Status | Agents list shows statuses (Online, Idle, Thinking). |
| **CL-01** | Crew Lead | Day Plan | List of jobs appears sorted by time/route. |
| **CL-02** | Crew Lead | Job Detail | Clicking a job reveals address, scope, and customer notes. |
| **CM-01** | Crew Member | Read Access | Can view schedule but cannot alter route/assignments. |

## 5. Execution
Run the test suite using the following command:
```bash
npx playwright test
```