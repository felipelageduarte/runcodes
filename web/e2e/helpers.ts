import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Contas seedadas no banco de local-dev (ver local-dev/README.md) —
 * as mesmas usadas manualmente ao longo do desenvolvimento das Fases
 * 1-5. E2E aqui assume o stack de local-dev já rodando (backend +
 * Postgres), não sobe/derruba nada sozinho. */
export const DEMO_ACCOUNTS = {
  admin: { email: "admin.demo@runcodes.test", password: "senha123" },
  student: { email: "aluno.demo@runcodes.test", password: "senha123" },
} as const;

export async function loginAs(page: Page, account: { email: string; password: string }) {
  await page.goto("/entrar");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Senha").fill(account.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

/** Preenche e confirma que o valor realmente ficou — formulários com
 * react-hook-form ocasionalmente perdem um fill() anterior quando outro
 * campo é preenchido logo em seguida (não reproduzido num clique/digitação
 * real, só em preenchimento automatizado em sequência muito rápida).
 * Tenta de novo em vez de deixar o teste falhar por uma corrida do
 * próprio preenchimento automatizado. */
export async function fillAndVerify(locator: Locator, value: string, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    await locator.fill(value);
    if ((await locator.inputValue()) === value) return;
  }
  // Última tentativa — deixa o erro real e descritivo aparecer se nem
  // assim colar, em vez de engolir uma falha genuína.
  await expect(locator).toHaveValue(value);
}
