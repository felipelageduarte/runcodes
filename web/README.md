# runcodes-web

Frontend novo do run.codes — React 19 + TypeScript + Vite, consumindo só o `runcodes-api`. Documentação completa (arquitetura, jornadas, design system, roadmap) em [`runcodes-docs`](https://github.com/runcodes-icmc/runcodes-docs), seção `frontend/`.

## Setup local

```bash
npm install
npm run dev          # http://localhost:5173, proxy /api e /docs -> localhost:3000
```

Precisa do `runcodes-api` rodando (ver `local-dev` pra subir a stack completa — Postgres, S3, compiler-engine).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Dev server com HMR |
| `npm run build` | Typecheck + build de produção |
| `npm run test` | Testes unitários/componente (Vitest + RTL + MSW) |
| `npm run test:watch` | Mesmo, em watch mode |
| `npm run test:e2e` | Testes E2E (Playwright) — sobe o dev server automaticamente |
| `npm run storybook` | Catálogo visual do design system |
| `npm run lint` | oxlint |

## Estrutura

```
src/
  app/            # shell: roteador raiz, providers, layout (AppShell)
  modules/        # áreas com rota própria: auth, student, professor, marketplace, admin
  packages/       # bibliotecas internas, importáveis por qualquer module: ui, api-client, auth, shared, editor
  test/           # setup de teste, mocks MSW
e2e/              # Playwright
```

Regra de fronteira: `modules/*` nunca importa de outro `modules/*` — só navega (rota). Tudo reusável mora em `packages/*`. Detalhe completo em [docs/frontend/overview.md](https://github.com/runcodes-icmc/runcodes-docs) do repo de documentação.

Segunda regra de fronteira: **nada em `web/` lê arquivo fora de `web/`** (import, alias, config). O teste `src/test/boundary.test.ts` falha se isso regredir; é o que permite a extração abaixo.

## Variáveis de build

Lidas em tempo de `npm run build` (Vite embute no bundle; mudar exige rebuild). Só dois arquivos leem `import.meta.env`:

| Variável | Default | Onde é lida | Efeito |
|---|---|---|---|
| `VITE_API_URL` | `/api` (mesmo host) | `src/packages/api-client/src/http.ts` (`apiBase()`) | Origem da API. Ex.: `https://api.run.codes`. Toda chamada e todo link de download passam por aqui. |
| `VITE_DOCS_URL` | `/docs` (mesmo host) | `src/config.ts` (`docsUrl()`) | Base do site de documentação (manual do usuário e `admin-docs`). |

Restrições quando a API fica em outra origem:

- A sessão é cookie `httpOnly` com `sameSite: lax`; front e API precisam estar no **mesmo site registrável** (ex.: `app.run.codes` e `api.run.codes`). Em site diferente o cookie não viaja e o login quebra.
- A API precisa liberar a origem do front no CORS com `credentials` (`api/src/app.ts`).
- Toda mutação (`POST`, `PUT`, `PATCH`, `DELETE`) feita por `apiFetch` leva `X-Requested-With: runcodes-web`; a API passa a exigir esse cabeçalho como barreira anti-CSRF (fase F2 da spec). Links de download (`<a href>`) são `GET` e não levam.
- `docsUrl("/admin-docs/")` só abre com a sessão de admin, então o host de docs segue a mesma regra do cookie.

Exemplo de build apontando para hosts externos:

```bash
VITE_API_URL=https://api.exemplo VITE_DOCS_URL=https://docs.exemplo npm run build
```

## Contrato do artefato `dist/`

`npm run build` gera `dist/`: site estático (HTML, JS, CSS, assets com hash no nome, `index.html` sem hash). Quem serve precisa de:

1. **Fallback de SPA:** toda rota que não é arquivo devolve `index.html` (o roteador é client-side). No Caddy: `try_files {path} /index.html`; no CloudFront/S3: erro 403/404 reescrito para `/index.html` com status 200.
2. **Cache:** `assets/*` imutável (`Cache-Control: public, max-age=31536000, immutable`); `index.html` sem cache (`no-cache`), senão deploy novo não aparece.
3. **Mesmo host ou mesmo site da API** (ver acima). Com as variáveis nos defaults, o servidor que entrega `dist/` também precisa encaminhar `/api` e `/docs` para a API.

Hoje o monorepo faz isso em `deploy/compose/docker-compose.prod.yml` (serviço `web-build` roda `npm ci && npm run build` dentro de `web/` e copia `dist/` para o volume `web-dist`) e o Caddy serve `/srv/web` com o fallback de SPA (`deploy/compose/Caddyfile`; os cabeçalhos de cache do item 2 ainda não estão lá e ficam para a spec de extração). O build não lê nenhum arquivo de fora de `web/`, então esse contrato vale igual para um repositório separado.

## Roteiro de extração para repositório próprio

Spec: `docs/specs/admin-e-separacao-front.md` (seção 3). A extração em si (repo novo, CI, hospedagem) ganha spec própria; este é o roteiro mecânico, preservando o histórico de `web/`.

```bash
# no monorepo, com a main atualizada
git fetch origin && git checkout origin/main
git subtree split --prefix=web -b web-extract

# repo novo (vazio, criado no GitHub)
git clone git@github.com:<org>/runcodes-web.git ../runcodes-web
cd ../runcodes-web
git pull ../runcodes web-extract
git push origin main
```

Depois do push, no repo novo:

1. `npm ci && npm run lint && npm test && npm run build` precisa passar sem nenhuma mudança (é o que a F0 garante). O teste `src/test/contract.test.ts` é pulado automaticamente, porque `api/src/lib/constants.ts` não existe mais ao lado; o contrato de constantes passa a ser verificado no repo da API ou por OpenAPI.
2. Criar o CI do repo novo com os mesmos três passos e as variáveis `VITE_API_URL` e `VITE_DOCS_URL` do ambiente de destino.
3. Publicar `dist/` seguindo o contrato acima e apontar o DNS no mesmo site registrável da API.
4. Só então remover `web/` do monorepo e o serviço `web-build` do compose, em PR próprio.

Até lá, `web/` continua no monorepo e o deploy continua pelo compose. Nada muda para quem desenvolve.
