/** Configuração de build do front: tudo que muda entre ambientes e que
 * não é rota interna do app vive aqui, lido de `VITE_*` em tempo de
 * build. Mantém o `web/` extraível: nenhum outro arquivo lê
 * `import.meta.env` além deste e de `packages/api-client/src/http.ts`
 * (`apiBase()`), e o teste de fronteira (src/test/boundary.test.ts)
 * garante isso. */

/** Base do site de documentação (Docusaurus). Default `/docs`: em dev o
 * Vite faz proxy pra API, em produção o Caddy encaminha pra API, que
 * serve o build. Com `VITE_DOCS_URL=https://docs.exemplo` o front aponta
 * pra um host externo sem mudar código. A seção `/admin-docs` só abre
 * com a sessão de admin, então o host externo precisa estar no mesmo
 * site registrável da API pra o cookie viajar. */
export function docsUrl(path = ""): string {
  const raw = import.meta.env.VITE_DOCS_URL;
  const base = raw && raw.trim() !== "" ? raw.replace(/\/+$/, "") : "/docs";
  return path ? `${base}/${path.replace(/^\/+/, "")}` : base;
}
