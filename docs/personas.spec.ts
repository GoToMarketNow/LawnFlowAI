import { test, expect } from '@playwright/test';

// Configuration constants
const BASE_URL = 'http://localhost:5173';

test.describe('LawnFlow.AI Persona Tests', () => {

  // ---------------------------------------------------------------------------
  // SUITE A: OWNER/ADMIN
  // ---------------------------------------------------------------------------
  test.describe('Persona: Owner/Admin', () => {
    test.beforeEach(async ({ page }) => {
      // Simulate login as Owner (Mock Mode bypasses real auth for now or uses a flag)
      await page.goto(`${BASE_URL}/dashboard?role=owner_admin`);
    });

    test('should display the Command Center with key metrics', async ({ page }) => {
      // Verify Header
      await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();

      // Verify KPI Tiles (Data from MOCK_METRICS)
      await expect(page.getByText('ROI')).toBeVisible();
      await expect(page.getByText('+145%')).toBeVisible(); // Specific mock value
      await expect(page.getByText('Active Workflows')).toBeVisible();
    });

    test('should visualize active workflows', async ({ page }) => {
      // Verify Workflow Cards (Data from MOCK_WORKFLOWS)
      await expect(page.getByText('Inbound Lead Handling')).toBeVisible();
      await expect(page.getByText('Rain Delay Rescheduling')).toBeVisible();
      
      // Verify specific steps exist
      await expect(page.getByText('Quote Generation')).toBeVisible();
    });

    test('should show agent status', async ({ page }) => {
      // Verify Agent List (Data from MOCK_AGENTS)
      await expect(page.getByText('Intake Specialist')).toBeVisible();
      await expect(page.getByText('Quote Engine')).toBeVisible();
      
      // Verify status badges
      await expect(page.getByText('Online').first()).toBeVisible();
    });

    test('should handle pending actions', async ({ page }) => {
      // Navigate to Pending Actions
      await page.goto(`${BASE_URL}/pending-actions`);
      
      await expect(page.getByRole('heading', { name: 'Pending Actions' })).toBeVisible();
      
      // Check for specific mock action
      const actionCard = page.locator('div').filter({ hasText: 'Approve Quote #402' }).first();
      await expect(actionCard).toBeVisible();
      
      // Verify Confidence Score
      await expect(actionCard.getByText('82%')).toBeVisible();
      
      // Simulate Resolution
      await actionCard.getByRole('button', { name: 'Resolve' }).click();
      // In a real app, we'd assert the item disappears or a toast appears
    });
  });

  // ---------------------------------------------------------------------------
  // SUITE B: CREW LEADER
  // ---------------------------------------------------------------------------
  test.describe('Persona: Crew Leader', () => {
    test.beforeEach(async ({ page }) => {
      // Simulate login as Crew Leader
      await page.goto(`${BASE_URL}/schedule?role=crew_lead`);
    });

    test('should view the Today Plan', async ({ page }) => {
      // Verify Schedule Header
      await expect(page.getByRole('heading', { name: /Today|Schedule/i })).toBeVisible();

      // Verify Jobs List (Data from MOCK_JOBS)
      // Assuming the UI renders jobs with customer names
      await expect(page.getByText('Alice Johnson')).toBeVisible();
      await expect(page.getByText('Weekly Mow')).toBeVisible();
    });

    test('should view job details', async ({ page }) => {
      // Click on a specific job
      await page.getByText('Alice Johnson').click();

      // Verify details drawer or page
      // Note: Adjust selector based on actual UI implementation
      await expect(page.getByText('Crew Alpha')).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // SUITE C: CREW MEMBER
  // ---------------------------------------------------------------------------
  test.describe('Persona: Crew Member', () => {
    test.beforeEach(async ({ page }) => {
      // Simulate login as Crew Member
      await page.goto(`${BASE_URL}/schedule?role=crew_member`);
    });

    test('should have read-only access to schedule', async ({ page }) => {
      // Verify jobs are visible
      await expect(page.getByText('Alice Johnson')).toBeVisible();

      // Verify administrative controls are ABSENT
      // e.g., "Reassign Crew" or "Edit Quote" buttons should not exist
      await expect(page.getByRole('button', { name: 'Reassign' })).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve' })).not.toBeVisible();
    });
  });

});