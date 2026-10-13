import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, loginAs } from "./helpers";

test.describe("jornada do marketplace", () => {
  test("busca, abre o detalhe e vê o enunciado de um exercício publicado", async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto("/marketplace");

    await expect(page.getByText("Soma de dois números")).toBeVisible();
    await page.getByText("Soma de dois números").click();

    await expect(page).toHaveURL(/\/marketplace\/\d+$/);
    await expect(page.getByRole("heading", { name: "Soma de dois números" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adotar nesta turma" })).toBeVisible();
  });

  test("filtra por busca de texto", async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto("/marketplace");

    await page.getByPlaceholder("Buscar por título ou palavra-chave...").fill("fibonacci-inexistente-xyz");
    await page.waitForTimeout(400); // debounce do campo de busca
    await expect(page.getByText("Nenhum exercício encontrado")).toBeVisible();
  });
});
