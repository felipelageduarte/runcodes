# runcodes-web

Frontend novo do run.codes — React 19 + TypeScript + Vite, consumindo só o `runcodes-api`. Documentação completa (arquitetura, jornadas, design system, roadmap) em [`runcodes-docs`](https://github.com/runcodes-icmc/runcodes-docs), seção `frontend/`.

## Setup local

```bash
npm install
npm run dev          # http://localhost:5173, proxy /api -> localhost:3000
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
