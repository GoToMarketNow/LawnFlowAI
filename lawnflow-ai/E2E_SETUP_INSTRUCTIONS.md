# Playwright E2E Testing Setup for LawnFlow.AI

This document outlines the complete setup for End-to-End (E2E) testing of the LawnFlow.AI application using Playwright.

## 1. Installation

First, install the necessary dependencies:

```bash
npm install -D @playwright/test
```

Then, install the Playwright browsers:

```bash
npx playwright install
```

## 2. Project Structure

The E2E tests are located in the `lawnflow-ai/e2e` directory, with the following structure:

```
lawnflow-ai/
├── e2e/
│   ├── specs/
│   │   ├── login.spec.ts
│   │   ├── navigation.spec.ts
│   │   ├── dashboard.spec.ts
│   │   ├── pending-actions.spec.ts
│   │   ├── mobile.spec.ts
│   │   └── workflow.spec.ts
│   ├── support/
│   │   ├── global-setup.ts
│   │   ├── global-teardown.ts
│   │   └── test-utils.ts
│   └── COMPONENT_RECOMMENDATIONS.md
├── playwright.config.ts
└── package.json
```

## 3. Configuration

The `playwright.config.ts` file is configured to run tests against the Vite dev server. It includes multiple projects for cross-browser and cross-device testing.

## 4. Running Tests

The following npm scripts have been added to `package.json`:

- `npm run test:e2e`: Run all tests in headless mode.
- `npm run test:e2e:ui`: Run tests in UI mode.
- `npm run test:e2e:headed`: Run tests in headed mode.
- `npm run test:e2e:report`: Show the HTML report of the last test run.

## 5. Component-Level Recommendations

To ensure stable tests, it is recommended to add `data-testid` attributes to the components as described in `lawnflow-ai/e2e/COMPONENT_RECOMMENDATIONS.md`.

By following these steps, you will have a complete and robust E2E testing environment for your LawnFlow.AI application.
