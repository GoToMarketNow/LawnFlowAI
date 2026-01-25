
import { test, expect } from '../support/test-utils';

test.describe('Pending Actions Flow', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/pending-actions');
  });

  test('should approve a task and see it removed', async ({ loggedInPage }) => {
    const taskCard = loggedInPage.getByTestId('task-card-1');
    await expect(taskCard).toBeVisible();

    // Mock the API call for approval
    await loggedInPage.route('**/api/tasks/1/approve', (route) => {
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await taskCard.getByRole('button', { name: 'Approve' }).click();

    // The card should be removed optimistically
    await expect(taskCard).not.toBeVisible();
    // A toast notification should appear
    await expect(loggedInPage.getByText('Task 1 approved.')).toBeVisible();
  });

  test('should reject a task', async ({ loggedInPage }) => {
    const taskCard = loggedInPage.getByTestId('task-card-2');
    await expect(taskCard).toBeVisible();

    await loggedInPage.route('**/api/tasks/2/reject', (route) => {
        route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });


    await taskCard.getByRole('button', { name: 'Reject' }).click();
    await expect(taskCard).not.toBeVisible();
    await expect(loggedInPage.getByText('Task 2 rejected.')).toBeVisible();
  });
});
