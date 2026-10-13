import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, loginAs } from "./helpers";

test.describe("jornada do aluno", () => {
  test("vê a fila de exercícios e a turma em que está matriculado", async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.student);

    await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();
    await expect(page.getByText("Soma de dois números")).toBeVisible();
  });

  test("abre um exercício e vê o enunciado", async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.student);

    await page.getByText("Soma de dois números").click();
    await expect(page).toHaveURL(/\/exercicios\/\d+$/);
    await expect(page.getByRole("heading", { name: "Soma de dois números" })).toBeVisible();
  });

  test("não enxerga Marketplace nem Admin na navegação (papel aluno)", async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.student);

    await expect(page.getByRole("link", { name: "Marketplace" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).not.toBeVisible();
  });

  test("uma rota admin direta redireciona pro painel (RequireRole)", async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.student);

    await page.goto("/admin");
    await expect(page).toHaveURL("/");
  });
});
