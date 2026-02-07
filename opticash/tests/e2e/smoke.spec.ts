import { test, expect } from "@playwright/test";
import path from "path";

const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
const hasStripe = Boolean(process.env.E2E_STRIPE);

test.describe("OptiCash E2E smoke", () => {
  test.skip(!hasCreds, "E2E_EMAIL / E2E_PASSWORD are required");

  test("login session works", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/login/);
  });

  test("import CSV and reach plan", async ({ page }) => {
    await page.goto("/import/csv");

    const filePath = path.join(process.cwd(), "opticash-300.csv");
    await page.setInputFiles("#csv", filePath);
    await page.getByRole("button", { name: /uploader/i }).click();

    await expect(page.getByText(/Preview/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /continuer/i }).click();

    const success = page.getByText("Import réussi ✅ Scan créé.").first();
    const limit = page.getByText(/Limite gratuite/i);

    const result = await Promise.race([
      success.waitFor({ timeout: 25_000 }).then(() => "success"),
      limit.waitFor({ timeout: 25_000 }).then(() => "limit"),
    ]);

    if (result === "success") {
      await page.getByRole("link", { name: /voir mon plan/i }).first().click();
      await expect(page).toHaveURL(/plan/);
      await expect(page.getByRole("heading", { name: /Ton plan OptiCash/i })).toBeVisible();
    } else {
      await expect(page.getByText(/Premium/i)).toBeVisible();
    }
  });

  test("plan displays actions", async ({ page }) => {
    await page.goto("/plan");
    const actionButton = page.getByRole("button", { name: /marquer comme fait/i });
    const planTitle = page.getByRole("heading", { name: /Ton plan OptiCash/i });
    await expect(planTitle).toBeVisible();
    if (await actionButton.count()) {
      await expect(actionButton.first()).toBeVisible();
    }
  });

  test("findings page loads", async ({ page }) => {
    await page.goto("/findings");
    await expect(page.getByText(/Fuites détectées|Aucune analyse/i)).toBeVisible();
  });

  test("impots boost modal opens", async ({ page }) => {
    await page.goto("/plan");
    await page.getByRole("button", { name: /Remplir manuellement/i }).click();
    await expect(page.getByRole("heading", { name: /Impôts Boost/i })).toBeVisible();
    await expect(page.getByText(/Salaire mensuel moyen/i)).toBeVisible();
    await page.getByRole("button", { name: /Passer/i }).click();
  });

  test("expenses page access", async ({ page }) => {
    await page.goto("/expenses");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    await expect(page.locator("body")).not.toContainText(
      "Application error: a client-side exception has occurred"
    );
    await expect(page).toHaveURL(/expenses/);
  });

  test.skip(!hasStripe, "E2E_STRIPE=1 required for checkout test");
  test("stripe checkout opens", async ({ page }) => {
    await page.goto("/upgrade");
    await page.getByRole("button", { name: /Passer premium/i }).click();
    await page.waitForURL(/stripe\.com|checkout\.stripe\.com/, { timeout: 20_000 });
  });
});
