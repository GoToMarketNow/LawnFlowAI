
import { test, expect } from '../support/test-utils';

test.describe('Mobile-specific tests', () => {
  test.use({ ...test.devices['Pixel 5'] });

  test('should open and close the hamburger menu', async ({ page }) => {
    await page.goto('/');
    const hamburgerMenu = page.getByTestId('hamburger-menu');
    await expect(hamburgerMenu).toBeVisible();

    await hamburgerMenu.click();
    await expect(page.getByTestId('sidebar-nav-dashboard')).toBeVisible();

    // In a real app, you would click an overlay or a close button.
    // Here we will just click the hamburger menu again to close.
    await hamburgerMenu.click();
    await expect(page.getByTestId('sidebar-nav-dashboard')).not.toBeVisible();
  });

  test('should show the mobile focus layout for crew members', async ({ page }) => {
    // This requires a way to log in as a crew member.
    // We will simulate this by directly navigating to the crew member view.
    await page.goto('/my-route'); 
    await expect(page.getByRole('button', { name: 'Start Job' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete Job' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clock Out' })).toBeVisible();
  });
});
