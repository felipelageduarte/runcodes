import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, loginAs } from "./helpers";

test.describe("view-as (impersonação)", () => {
  test("troca pra um papel rebaixado, mostra o indicador e bloqueia rotas acima do papel visto", async ({
    page,
  }, testInfo) => {
    // "Ver como" só existe na sidebar desktop/tablet hoje — decisão
    // de escopo registrada ao construir a feature (nav mobile já
    // compacta vários itens, não ganhou entrada própria ainda).
    test.skip(testInfo.project.name === "mobile", "Ver como só está na sidebar desktop por enquanto");
    await loginAs(page, DEMO_ACCOUNTS.admin);

    await page.getByRole("button", { name: "Ver como" }).click();
    await page.getByRole("button", { name: "Aluno", exact: true }).click();

    await expect(page.getByText(/Vendo como/)).toBeVisible();
    await expect(page.getByText(/seu papel real é/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).not.toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL("/");
  });

  test("voltar ao normal restaura o papel real", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Ver como só está na sidebar desktop por enquanto");
    await loginAs(page, DEMO_ACCOUNTS.admin);

    await page.getByRole("button", { name: "Ver como" }).click();
    await page.getByRole("button", { name: "Professor", exact: true }).click();
    await expect(page.getByText(/Vendo como/)).toBeVisible();

    await page.getByRole("button", { name: "Voltar ao normal" }).click();
    await expect(page.getByText(/Vendo como/)).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  });

  test("o dialog de 'ver como' nunca oferece um papel igual ou acima do real", async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.student);

    // Aluno é o papel mais baixo — não tem nada pra rebaixar, o botão
    // "Ver como" nem deveria aparecer.
    await expect(page.getByRole("button", { name: "Ver como" })).not.toBeVisible();
  });
});
