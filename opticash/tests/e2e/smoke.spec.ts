import { test, expect } from "@playwright/test";
import path from "path";

const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

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

  test("expenses page access", async ({ page }) => {
    await page.goto("/expenses");
    const premiumGate = page.getByText(/Accès Premium requis/i);
    const tableTitle = page.getByText(/Tableau ligne par ligne/i);

    const premiumShown = await premiumGate.isVisible().catch(() => false);
    if (premiumShown) {
      await expect(premiumGate).toBeVisible();
      return;
    }

    const tableShown = await tableTitle.isVisible().catch(() => false);
    if (tableShown) {
      await expect(tableTitle).toBeVisible();
      return;
    }

    await page.waitForTimeout(2000);
    await expect(premiumGate.or(tableTitle)).toBeVisible();
  });
});
