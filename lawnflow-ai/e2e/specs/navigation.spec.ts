
import { test, expect, switchLanguage } from '../support/test-utils';

const navItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Pending Actions', path: '/pending-actions' },
    { name: 'Job Map', path: '/job-map' },
    { name: 'Agent Config', path: '/agent-config' },
];

test.describe('Sidebar Navigation and Language Toggle', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    for (const item of navItems) {
        test(`navigates to ${item.name}`, async ({ page }) => {
            await page.getByTestId(`sidebar-nav-${item.name.toLowerCase().replace(' ', '-')}`).click();
            await expect(page).toHaveURL(item.path);
            await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
        });
    }

    test('switches language from EN to ES and back', async ({ page }) => {
        // English is the default
        await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

        // Switch to Spanish
        await switchLanguage(page, 'es');
        await expect(page.getByRole('heading', { name: 'Tablero' })).toBeVisible();

        // Switch back to English
        await switchLanguage(page, 'en');
        await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
});
