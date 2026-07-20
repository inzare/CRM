import { expect, test, type Locator, type Page } from '@playwright/test';

const suffix = Date.now().toString();
async function signIn(
  page: Page,
  email = 'admin@consultflow.local',
  password = 'ConsultFlow!2026',
) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Good to see you/i })).toBeVisible();
}
async function selectMatching(select: Locator, pattern: RegExp): Promise<void> {
  const value = await select
    .locator('option')
    .filter({ hasText: pattern })
    .first()
    .getAttribute('value');
  if (!value) throw new Error(`No option matched ${String(pattern)}`);
  await select.selectOption(value);
}

test.describe.serial('ConsultFlow required journeys', () => {
  test('sign in and sign out', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
  test('user management permissions and role navigation', async ({ page }) => {
    await signIn(page, 'consultant@consultflow.local');
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: /not available for your role/i })).toBeVisible();
  });
  test('company and contact creation', async ({ page }) => {
    await signIn(page, 'manager@consultflow.local');
    await page.getByRole('link', { name: 'Companies' }).click();
    await page.getByRole('button', { name: 'New company' }).click();
    await page.getByLabel('Company name').fill(`E2E Company ${suffix}`);
    await page.getByLabel('Industry').fill('Software');
    await page.getByLabel('Website').fill('https://example.com');
    await page.getByLabel('Tags').fill('E2E, Priority');
    await page.getByRole('button', { name: 'Save record' }).click();
    await expect(page.getByRole('heading', { name: `E2E Company ${suffix}` })).toBeVisible();
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByLabel('First name').fill('Linus');
    await page.getByLabel('Last name').fill('Torvalds');
    await page.getByLabel('Email').fill(`linus-${suffix}@example.com`);
    await page.getByLabel('Decision maker').check();
    await page.getByRole('button', { name: 'Save record' }).click();
    await expect(page.getByText('Linus Torvalds')).toBeVisible();
  });
  test('lead qualification and conversion', async ({ page }) => {
    await signIn(page, 'sales@consultflow.local');
    await page.getByRole('link', { name: 'Leads' }).click();
    await page.getByRole('button', { name: 'New lead' }).click();
    await page.getByLabel('Company').fill(`E2E Company ${suffix}`);
    await page.getByLabel('First name').fill('Linus');
    await page.getByLabel('Last name').fill('Torvalds');
    await page.getByLabel('Interest', { exact: true }).fill('Product engineering engagement');
    await page.getByLabel('Budget').fill('80000');
    await page.getByRole('button', { name: 'Create lead' }).click();
    const leadRow = page
      .getByRole('row')
      .filter({ hasText: `E2E Company ${suffix}` })
      .first();
    page.once('dialog', (dialog) =>
      dialog.accept('Budget, authority, need, and timing confirmed.'),
    );
    await leadRow.getByRole('button', { name: 'Qualify' }).click();
    page.on('dialog', async (dialog) => {
      await dialog.accept(
        dialog.message().includes('value')
          ? '80000'
          : new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      );
    });
    const conversion = page.waitForResponse(
      (response) => response.url().includes('/leads/') && response.url().endsWith('/convert'),
    );
    await leadRow.getByRole('button', { name: 'Convert' }).click();
    const conversionResponse = await conversion;
    expect(
      conversionResponse.ok(),
      `Lead conversion failed: ${await conversionResponse.text()}`,
    ).toBe(true);
    await expect(page.getByText(new RegExp(`E2E Company ${suffix} opportunity`))).toBeVisible();
  });
  test('opportunity pipeline movement', async ({ page }) => {
    await signIn(page, 'sales@consultflow.local');
    await page.getByRole('link', { name: 'Pipeline' }).click();
    const card = page.locator('article').filter({
      has: page.getByRole('heading', { name: `E2E Company ${suffix} opportunity` }),
    });
    const movement = page.waitForResponse(
      (response) =>
        response.url().includes('/opportunities/') && response.url().endsWith('/transition'),
    );
    await card.getByRole('combobox').selectOption({ label: 'Proposal' });
    expect((await movement).ok()).toBe(true);
    await expect(page.getByRole('region', { name: 'Proposal' })).toContainText(
      `E2E Company ${suffix} opportunity`,
    );
  });
  test('quote creation and acceptance', async ({ page }) => {
    await signIn(page, 'manager@consultflow.local');
    await page.getByRole('link', { name: 'Catalog' }).click();
    await page.getByRole('button', { name: 'New offering' }).click();
    await page.getByLabel('SKU').fill(`E2E-${suffix}`);
    await page.getByLabel('Name').fill('E2E advisory');
    await page.getByLabel('Price').fill('1000');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('link', { name: 'Quotes' }).click();
    await page.getByRole('button', { name: 'Create quote' }).click();
    await selectMatching(
      page.getByLabel('Opportunity'),
      new RegExp(`E2E Company ${suffix} opportunity`),
    );
    await page
      .getByLabel('Valid until')
      .fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    await selectMatching(page.getByLabel('Offering'), new RegExp(`E2E-${suffix}`));
    await page.getByRole('button', { name: 'Save' }).click();
    const row = page
      .getByRole('row')
      .filter({ hasText: `E2E Company ${suffix} opportunity` })
      .first();
    await row.getByRole('button', { name: /Send/ }).click();
    await row.getByRole('button', { name: 'Accept' }).click();
    await expect(row).toContainText('ACCEPTED');
  });
  test('task completion', async ({ page }) => {
    await signIn(page, 'manager@consultflow.local');
    await page.getByRole('link', { name: 'Tasks' }).click();
    await page.getByRole('button', { name: 'New task' }).click();
    await page.getByLabel('Subject').fill(`E2E follow-up ${suffix}`);
    await page.getByLabel('Due').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await selectMatching(page.getByLabel('Assignee'), /Ana Torres/);
    await selectMatching(page.getByLabel('Company'), new RegExp(`E2E Company ${suffix}`));
    await page.getByRole('button', { name: 'Create task' }).click();
    await page.getByRole('button', { name: `Complete E2E follow-up ${suffix}` }).click();
    await expect(page.getByText(`E2E follow-up ${suffix}`)).toHaveClass(/line-through/);
  });
  test('dashboard visibility follows role', async ({ page }) => {
    await signIn(page);
    await expect(page.getByText('Weighted forecast')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'consultant@consultflow.local');
    await expect(page.getByText('Weighted forecast')).toHaveCount(0);
    await expect(page.getByText('My tasks today')).toBeVisible();
  });
});
