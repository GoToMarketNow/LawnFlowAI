import { test, expect } from '@playwright/test';

test.describe('LawnFlow E2E - Critical Flows', () => {
  test.beforeEach(async ({ page }) => {
    // In dev mode, we might have auto-login or a dev login bypass
    // For now, let's assume we can reach the home page
    await page.goto('/');
  });

  test('should navigate to leads page and see leads table', async ({ page }) => {
    // Click on Leads in the sidebar
    await page.click('text=Leads');
    
    // Check if we are on the leads page
    await expect(page).toHaveURL(/.*leads/);
    await expect(page.locator('h1')).toContainText('Leads Management');
    
    // Check if the table is visible
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('should open create job dialog', async ({ page }) => {
    // Click on Jobs in the sidebar
    await page.click('text=Jobs');
    
    // Check if we are on the jobs page
    await expect(page).toHaveURL(/.*jobs/);
    
    // Click on Create Job button
    await page.click('text=Create Job');
    
    // Check if the dialog is visible
    await expect(page.locator('text=Create New Job')).toBeVisible();
    await expect(page.locator('text=Customer')).toBeVisible();
  });

  test('should open create crew dialog', async ({ page }) => {
    // Click on Crews in the sidebar
    await page.click('text=Crews');
    
    // Check if we are on the crews page
    await expect(page).toHaveURL(/.*operations\/crews/);
    
    // Click on Create Crew button (if no crews exist) or the Plus button
    const createButton = page.locator('button:has-text("Create Crew")');
    await createButton.click();
    
    // Check if the dialog is visible
    await expect(page.locator('text=Create New Crew')).toBeVisible();
  });
});
