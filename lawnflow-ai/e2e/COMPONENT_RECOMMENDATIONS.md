
# Component-Level Recommendations for Testability

To make the LawnFlow.AI application more testable with Playwright, it's crucial to add `data-testid` attributes to key elements in the components. This provides a stable way to select elements in tests, independent of CSS classes or text content which may change.

Here are the recommendations for each component:

### Sidebar (`DashboardLayout.tsx`)
- Add `data-testid="sidebar-nav-{item.labelKey.toLowerCase().replace(' ', '-')}"` to each `NavLink` in the sidebar.
- Add `data-testid="hamburger-menu"` to the mobile menu button.

### TopBar (`DashboardLayout.tsx`)
- Add `data-testid="language-toggle"` to the language `Select` component.
- Add `data-testid="notifications-button"` to the notifications bell button.

### Dashboard (`Dashboard.tsx`)
- Add `data-testid="metric-card-{title.toLowerCase().replace(' ', '-')}"` to each `MetricCard`.
- Add `data-testid="workflow-visualizer"` to the `WorkflowVisualizer` component.
- In `WorkflowVisualizer.tsx`, add `data-testid="workflow-node-{node.id.toLowerCase().replace(' ', '-')}"` to each node in the graph.
- Add `data-testid="system-log"` to the `SystemLog` component.

### Pending Actions (`PendingActions.tsx`)
- Add `data-testid="task-card-{task.id}"` to each `TaskCard`.
- In `TaskCard.tsx`, add `data-testid="approve-button"` and `data-testid="reject-button"` to the respective buttons.

### Mobile View (`MyRoute.tsx`)
- Add `data-testid="start-job-button"` to the "Start Job" button.
- Add `data-testid="complete-job-button"` to the "Complete Job" button.
- Add `data-testid="clock-out-button"` to the "Clock Out" button.

### Login Page
- Add `data-testid="username-input"` to the username input field.
- Add `data-testid="password-input"` to the password input field.
- Add `data-testid="login-button"` to the login button.

By implementing these `data-testid` attributes, the Playwright tests will be more robust and less likely to break due to UI changes.
