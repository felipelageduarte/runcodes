import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ADMIN_PERMISSIONS } from "./admin-permissions.js";

/**
 * Contrato entre a API e a cópia do catálogo no front
 * (`web/src/packages/shared/src/adminPermissions.ts`). Decisão Q1 da spec:
 * duplicação com teste de contrato, sem OpenAPI por enquanto. Quando o
 * `web/` sair do monorepo, este teste pula (arquivo ausente) e o contrato
 * passa a ser garantido pela publicação do catálogo como pacote.
 */
const WEB_COPY = fileURLToPath(
  new URL("../../../web/src/packages/shared/src/adminPermissions.ts", import.meta.url),
);

describe("catálogo de permissões: cópia do web", () => {
  it.skipIf(!existsSync(WEB_COPY))("é idêntica à da API", async () => {
    const web = (await import(WEB_COPY)) as { ADMIN_PERMISSIONS: Record<string, number> };
    expect(web.ADMIN_PERMISSIONS).toEqual(ADMIN_PERMISSIONS);
  });
});
