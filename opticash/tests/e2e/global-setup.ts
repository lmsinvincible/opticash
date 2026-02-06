import { chromium, FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    return;
  }

  const baseURL = config.projects[0]?.use?.baseURL as string;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /continuer/i }).click();

  await page.waitForURL(/onboarding|dashboard|plan/, { timeout: 20_000 });
  await page.context().storageState({ path: "tests/e2e/.auth.json" });
  await browser.close();
}
