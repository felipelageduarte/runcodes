import { test, expect } from "@playwright/test";

test("login page renders the auth form", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("validates empty fields before hitting the API", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Informe seu email")).toBeVisible();
});

test("navigates to signup and back to login", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Cadastre-se" }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await page.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
});

test("an unauthenticated visit to the dashboard redirects to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);
});
