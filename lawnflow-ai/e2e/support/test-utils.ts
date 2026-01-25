
import { test as base } from '@playwright/test';
import { Page } from '@playwright/test';

export async function login(page: Page, username = 'owner', password = 'password') {
    await page.goto('/login');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('/');
}

export async function switchLanguage(page: Page, lang: 'en' | 'es') {
    await page.getByTestId('language-toggle').click();
    await page.getByRole('menuitem', { name: lang.toUpperCase() }).click();
}

export async function waitForWorkflowUpdate(page: Page) {
    // In a real app, this would wait for a websocket message or a specific DOM update.
    await page.waitForTimeout(1000);
}

type MyFixtures = {
    loggedInPage: Page;
};

export const test = base.extend<MyFixtures>({
    loggedInPage: async ({ page }, use) => {
        await login(page);
        await use(page);
    },
});

export { expect } from '@playwright/test';
