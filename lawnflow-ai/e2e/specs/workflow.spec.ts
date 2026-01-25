
import { test, expect, waitForWorkflowUpdate } from '../support/test-utils';

test.describe('Multi-agent workflow visualization', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/');
  });

  test('should update workflow visualization in real-time', async ({ loggedInPage }) => {
    const intakeNode = loggedInPage.getByTestId('workflow-node-intake');
    const quoteNode = loggedInPage.getByTestId('workflow-node-quote');
    const approvalNode = loggedInPage.getByTestId('workflow-node-human-approval');

    await expect(intakeNode).toHaveClass(/active/);
    await expect(quoteNode).not.toHaveClass(/active/);
    await expect(approvalNode).not.toHaveClass(/active/);

    // Simulate a workflow update (e.g., via a mocked WebSocket)
    await loggedInPage.evaluate(() => {
        // This is a mock. In a real app, you would have a WebSocket client
        // that receives updates and updates the component state.
        const event = new CustomEvent('workflow-update', { detail: { newNode: 'quote' } });
        window.dispatchEvent(event);
    });

    await waitForWorkflowUpdate(loggedInPage);

    await expect(intakeNode).not.toHaveClass(/active/);
    await expect(quoteNode).toHaveClass(/active/);
    await expect(approvalNode).not.toHaveClass(/active/);
  });
});
