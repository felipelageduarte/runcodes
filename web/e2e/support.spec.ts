import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, loginAs } from "./helpers";

test.describe("jornada de suporte", () => {
  test("abre um ticket e vê na lista de 'Meus tickets'", async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.student);
    await page.goto("/suporte");

    await page.getByRole("button", { name: "Abrir ticket" }).click();
    await page.getByLabel("Mensagem").fill("Ticket criado por teste E2E.");
    await page.getByRole("button", { name: "Abrir" }).click();

    // .first(): roda contra o backend real de local-dev, não resetado
    // entre execuções — já pode existir mais de um ticket com esse texto
    // de runs anteriores. O que importa é que PELO MENOS um apareceu.
    await expect(page.getByText("Ticket criado por teste E2E.").first()).toBeVisible();
  });

  test("staff vê a fila e consegue fechar um ticket", async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto("/suporte");

    await page.getByRole("tab", { name: "Fila" }).click();
    const row = page.getByRole("row").filter({ hasText: "Ticket criado por teste E2E." }).first();
    // A fila mostra só o status, não a mensagem completa — cai pro
    // primeiro ticket aberto da lista se o texto não estiver na linha.
    const target = (await row.count()) > 0 ? row : page.getByRole("row").nth(1);
    await target.getByRole("button", { name: "Ver" }).click();

    // "Fechar" também é o nome acessível do X de fechar o dialog (texto
    // sr-only) — escopa pro formulário pra pegar só o botão de status.
    await page.locator("form").getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByText("Ticket fechado")).toBeVisible();
  });

  test("qualquer um lê a FAQ sem estar logado como staff", async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.student);
    await page.goto("/suporte");

    await page.getByRole("tab", { name: "FAQ" }).click();
    await expect(page.getByRole("button", { name: "Nova pergunta" })).not.toBeVisible();
  });
});
