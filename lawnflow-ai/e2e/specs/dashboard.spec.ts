
import { test, expect } from '../support/test-utils';

test.describe('Dashboard Rendering', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/');
  });

  test('should display metrics cards', async ({ loggedInPage }) => {
    await expect(loggedInPage.getByTestId('metric-card-total-roi')).toBeVisible();
    await expect(loggedInPage.getByTestId('metric-card-leads-recovered')).toBeVisible();
    await expect(loggedInPage.getByTestId('metric-card-active-workflows')).toBeVisible();
  });

  test('should display the workflow visualizer', async ({ loggedInPage }) => {
    await expect(loggedInPage.getByTestId('workflow-visualizer')).toBeVisible();
    // Check for a specific node in the mock visualizer
    await expect(loggedInPage.getByText('Quote', { exact: true })).toBeVisible();
  });

  test('should display the system log', async ({ loggedInPage }) => {
    await expect(loggedInPage.getByTestId('system-log')).toBeVisible();
    await expect(loggedInPage.getByText(/New lead received/)).toBeVisible();
  });
});
