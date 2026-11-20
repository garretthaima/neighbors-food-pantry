import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const PIN = '2468';
const CORN = '024000163022';
const SOUP = '051000012517';
// Both screen sizes share one database, so each needs its own unknown barcode.
const UNKNOWN = { phone: '037000127116', desktop: '037000127123' } as const;

/** Nothing may be reachable only by scrolling sideways. */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page is wider than the screen').toBeLessThanOrEqual(0);
}

async function signIn(page: Page) {
  await page.goto('/#/scan');
  await page.getByLabel('Volunteer PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#barcode')).toBeFocused();
}

async function scan(page: Page, barcode: string) {
  await page.locator('#barcode').fill(barcode);
  await page.keyboard.press('Enter');
}

test.describe.configure({ mode: 'serial' });

test('a visitor can look but not change anything', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add one/ })).toHaveCount(0);
  await expectNoSidewaysScroll(page);

  await page.getByRole('link', { name: 'Scan' }).click();
  await page.getByLabel('Volunteer PIN').fill('0000');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('That PIN is not right.');
  await expectNoSidewaysScroll(page);
});

test('a volunteer sets up a shelf, receives donations and gives one out', async ({ page }, testInfo) => {
  const shelf = `A1 ${testInfo.project.name}`;
  await signIn(page);

  // Set up a shelf from the Shelves screen.
  await page.getByRole('link', { name: 'Shelves' }).click();
  await page.getByRole('button', { name: /^(Set up shelves|Shelves)$/ }).click();
  await page.getByLabel('New shelf').fill(shelf);
  await page.getByRole('button', { name: 'Add shelf' }).click();
  await expect(page.getByRole('status').getByText('Shelf added')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Close' }).click();

  // Receive two cans of corn onto it.
  await page.getByRole('link', { name: 'Scan' }).click();
  await page.getByLabel('Put on shelf').selectOption({ label: shelf });
  await scan(page, CORN);
  const latest = page.locator('.row.is-latest');
  await expect(latest).toContainText('Whole Kernel Corn');
  await expect(latest).toContainText(shelf);
  await expect(page.locator('#barcode')).toBeFocused();
  await scan(page, CORN);
  await expect(page.locator('.scan-log .row')).toHaveCount(2);

  // An unknown barcode asks for a name once.
  const unknown = UNKNOWN[testInfo.project.name as keyof typeof UNKNOWN];
  await scan(page, unknown);
  const dialog = page.getByRole('dialog', { name: 'Add item' });
  await expect(dialog.getByLabel('Barcode')).toHaveValue(`0${unknown}`);
  await dialog.getByRole('button', { name: 'Add item' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Give the item a name.');
  await dialog.getByLabel('Name').fill(`Dish soap ${testInfo.project.name}`);
  await expectNoSidewaysScroll(page);
  await dialog.getByRole('button', { name: 'Add item' }).click();
  await expect(page.locator('.row.is-latest')).toContainText('New to the pantry');

  // Give one soup out, then undo it.
  await scan(page, SOUP);
  await page.getByRole('radio', { name: 'Giving out' }).click();
  await scan(page, SOUP);
  await expect(page.locator('.row.is-latest')).toContainText('−1');
  await page.locator('.row.is-latest').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.row.is-latest')).toContainText('Undone');
  await expectNoSidewaysScroll(page);

  // The shelves screen shows the result, and the count buttons work.
  await page.getByRole('link', { name: 'Shelves' }).click();
  const tag = page.locator('.shelf', { hasText: shelf });
  await expect(tag).toContainText('Whole Kernel Corn');
  const row = tag.locator('.row', { hasText: 'Whole Kernel Corn' });
  const before = Number(await row.locator('.qty').innerText());
  await row.getByRole('button', { name: 'Add one Whole Kernel Corn' }).click();
  await expect(row.locator('.qty')).toHaveText(String(before + 1));
  await expectNoSidewaysScroll(page);

  // Edit from the row title, through the panel.
  await row.getByRole('button', { name: 'Whole Kernel Corn', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit item' });
  await edit.getByLabel('Size').fill('15 oz');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').getByText('Changes saved')).toBeVisible();
  await expect(row).toContainText('15 oz');

  // Filtering to "Out" hides it; activity lists the changes.
  await page.getByRole('radio', { name: 'In stock' }).click();
  await expect(row).toBeVisible();
  await page.getByRole('link', { name: 'Activity' }).click();
  await expect(page.getByRole('heading', { name: 'Last 30 days' })).toBeVisible();
  await expect(page.getByText('Recent changes')).toBeVisible();
  await expectNoSidewaysScroll(page);
});
