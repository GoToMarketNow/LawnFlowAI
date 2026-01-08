
import { test, expect } from '../support/test-utils';

test('login and preserves authentication', async ({ loggedInPage, page }) => {
  await loggedInPage.goto('/');
  await expect(loggedInPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Verify that navigating to another page preserves the session
  await loggedInPage.goto('/pending-actions');
  await expect(loggedInPage.getByRole('heading', { name: 'Pending Actions' })).toBeVisible();

  // To test authentication persistence, we can check for the presence of a cookie or local storage item.
  const storageState = await loggedInPage.context().storageState();
  // This is a mock expectation. In a real app, you would check for a specific auth token.
  expect(storageState.origins[0].localStorage.length).toBeGreaterThan(0);
});
