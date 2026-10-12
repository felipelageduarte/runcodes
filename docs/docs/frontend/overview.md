---
title: runcodes-web — visão geral e arquitetura
sidebar_position: 1
---

# runcodes-web — visão geral e arquitetura

Este documento é o SDD (Software Design Document) de referência pro frontend novo. Cobre arquitetura, stack, padrões de código, e é o ponto de partida pra implementação — detalhes de cada área específica estão nos documentos vizinhos ([jornadas](./journeys.md), [design system](./design-system.md), [code editor](./code-editor.md), [marketplace](./marketplace.md), [segurança](./security.md), [testes](./testing.md), [roadmap](./roadmap.md)).

## Contexto e decisões já tomadas

- **React 19 + TypeScript + Vite** — decidido em [migration-strategy.md](../architecture/migration-strategy.md): maior ecossistema para editor de código embutido e grids de dados, maior pool de desenvolvedores.
- **Consome só `runcodes-api`** (Node/Express) — nunca o `server` (CakePHP) legado. O frontend novo não espera o backend terminar porque o backend **já terminou** ([backend overview](../backend/overview.md) — funcionalmente completo).
- **Tailwind CSS v4** — já no scaffold inicial do repo.
- **SPA modular, Module-Federation-ready** — um único build/deploy por enquanto (equipe pequena, sem necessidade de releases independentes por módulo), mas estruturado desde o dia 1 pra permitir separar em microfrontends reais depois, sem reescrever nada: cada "área" do produto é um módulo autocontido com fronteira clara (rotas, estado, tipos, API client próprios), montado por um shell/roteador comum. Virar isso em Module Federation de verdade no futuro é trocar "import estático" por "import remoto" na composição — a fronteira de domínio já está certa.
- **Editor de código**: Monaco Editor embutido (não `code-server`/VS Code completo) — ver [code-editor.md](./code-editor.md).
- **Jupyter**: fora de escopo por agora.

## Por que "SPA modular" e não microfrontends de verdade (ainda)

Microfrontend de verdade (times/módulos com deploy independente via Module Federation) resolve um problema que este projeto não tem hoje: múltiplos times trabalhando em paralelo em módulos com ciclos de release diferentes. Pagar a complexidade operacional disso agora (CI/CD por módulo, versionamento de contratos entre remotes, duplicação de runtime de React se não for cuidadoso) sem o problema que justifica é dívida técnica adiantada.

O que se compra agora, sem esse custo: **baixo acoplamento entre módulos de produto**. Cada módulo (`student`, `professor`, `marketplace`, `editor`, `admin`, ...) é uma pasta com sua própria árvore de rotas, hooks de dados, e tipos — só se comunica com o resto do app através de:
1. Um **contrato de rotas** (o shell registra `<Module path="/..." />`, nunca importa componentes internos de outro módulo).
2. Um **design system compartilhado** (`packages/ui` — só primitivos visuais, zero regra de negócio).
3. Um **cliente de API compartilhado** (`packages/api-client` — tipos gerados/derivados do contrato da API, zero UI).
4. Um **estado de sessão compartilhado** (quem é o usuário, que papéis tem) via um único hook/context — nenhum outro estado cruza módulo.

Essa estrutura é *exatamente* a fronteira que o Module Federation pediria se decidirmos separar de verdade depois — a migração nesse ponto futuro é mecânica (trocar o jeito como o shell importa o módulo), não arquitetural.

## Estrutura de pastas (monorepo single-app)

```
runcodes-web/
  src/
    app/                      # shell: roteador raiz, providers globais, layout base
      routes.tsx
      providers.tsx
      layout/
        AppShell.tsx           # casca com nav responsiva (sidebar desktop / bottom-nav mobile)
    modules/
      auth/                    # login, signup, confirmação, reset de senha
      student/                 # dashboard do aluno, lista de exercícios, submissão, notas
      professor/                # gestão de turma, exercícios, casos de teste, stats/csv, plágio
      marketplace/              # catálogo de exercícios públicos entre professores
      admin/                    # universidades, allowed-files, usuários, logs
      editor/                   # integração Monaco — usado por student e professor
      shared/                   # hooks/componentes usados por 2+ módulos de produto (não é "utils" genérico)
    packages/                   # (dentro do mesmo repo por ora — ver nota abaixo)
      ui/                       # design system: Button, Card, Table, Modal, Toast, Skeleton...
      api-client/               # 1 arquivo por recurso da API (auth.ts, exercises.ts, commits.ts...)
      auth/                     # AuthProvider, useSession, token storage — única fonte de verdade de "quem é o usuário"
    lib/                        # utilidades puras sem estado (formatters, date, csv parse client-side se precisar)
    test/                       # setup de testes, mocks (msw), fixtures compartilhadas
  e2e/                          # Playwright, fora de src (não faz parte do bundle)
```

`packages/*` vivem dentro do mesmo repo (não são pacotes npm publicados) — usamos path aliases do TypeScript (`@runcodes/ui`, `@runcodes/api-client`, `@runcodes/auth`) pra impor a fronteira de import sem o overhead operacional de um monorepo multi-pacote (Turborepo/Nx) que a escala atual do projeto não justifica. Se um dia esses pacotes precisarem de versionamento/release independente (ex. compartilhar o design system com outro produto), a extração é mecânica — a fronteira já existe.

## Stack completa

| Camada | Escolha | Por quê |
|---|---|---|
| Build/dev server | Vite | Já no scaffold; HMR rápido, build ESM nativo |
| Linguagem | TypeScript strict | Mesma disciplina do `runcodes-api` — tipos como documentação viva do contrato |
| UI framework | React 19 | Decidido em migration-strategy.md |
| Estilo | Tailwind CSS v4 | Já no scaffold; utility-first, zero CSS-in-JS runtime |
| Componentes base | Radix UI (primitivos sem estilo) + Tailwind | Acessibilidade (ARIA, foco, teclado) correta por padrão, sem depender de disciplina manual em cada componente |
| Roteamento | React Router v7 (data mode) | Loaders/actions por rota dão lugar natural pra isolar chamadas de API por módulo, code-splitting por rota de fábrica |
| Dados remotos | TanStack Query | Cache, revalidação, estados de loading/erro — commits em polling (`GET /api/commits/:id` até saír de `IN_QUEUE`) usam `refetchInterval`, não poll manual |
| Formulários | React Hook Form + Zod | Zod já é o validador do `runcodes-api` — o mesmo schema (ou um irmão gerado a partir do mesmo contrato) valida no cliente antes de gastar uma request |
| Estado de UI local | React state/context — **sem Redux/Zustand global** | Não há estado de app complexo compartilhado fora de sessão (que mora em `packages/auth`) e cache de servidor (que mora no TanStack Query). Introduzir uma lib de estado global sem um problema que a justifique é a mesma dívida adiantada do Module Federation prematuro. |
| Editor de código | Monaco Editor (`@monaco-editor/react`) | Ver [code-editor.md](./code-editor.md) |
| Ícones | Lucide React | Consistente, tree-shakeable, sem sprite sheet |
| Testes unitários/componente | Vitest + React Testing Library | Mesmo runner do backend (Vitest), consistência entre repos |
| Mock de API em teste | MSW (Mock Service Worker) | Intercepta `fetch` real — testa o componente como ele realmente chama a API, sem mockar `fetch` manualmente |
| E2E | Playwright | Cobre jornadas completas (login → submeter → ver nota) contra um `runcodes-api` real de teste, mesmo espírito dos testes de integração do backend |
| Lint | oxlint (já no scaffold) + regras type-aware | Rápido, já configurado |
| Documentação de componentes | Storybook | Cada componente do design system tem uma story — é também a ferramenta de revisão visual com o time (UX) sem precisar montar a tela inteira |

## Padrões de código e princípios de design

- **Container/Presenter nas rotas de módulo**: toda rota tem um componente "page" (busca dados via hook de query, trata loading/erro/vazio) e delega a apresentação pra componentes puros em `components/` dentro do módulo — testáveis sem rede.
- **Um hook por recurso de API, nunca `fetch` direto em componente**: `useExercise(id)`, `useSubmitCommit()`, etc., todos em `packages/api-client` ou no módulo dono do recurso, encapsulando TanStack Query. Componente nunca sabe que existe HTTP.
- **Erros de domínio tipados no cliente espelham os do backend**: `runcodes-api` já devolve `{ error: string, code?: string }` tipado por `domain/errors.ts`. O `api-client` mapeia isso pra um tipo `ApiError` com `code` discriminável — permite UI tratar `account_not_confirmed` diferente de `invalid_credentials` sem parsear string solta.
- **Composição sobre herança/configuração excessiva**: componentes do design system expõem slots/children, não um painel de 30 props booleanas pra cada variação visual.
- **Sem lógica de autorização duplicada no cliente além de UX**: o cliente esconde/mostra ações conforme o papel do usuário (`useSession().role`) só pra não mostrar um botão que vai dar 403 — a autorização de verdade é sempre do servidor. Isso é UX, nunca segurança (ver [security.md](./security.md)).
- **Responsivo por padrão, não "também funciona no mobile"**: todo componente novo é desenhado mobile-first (ver [design-system.md](./design-system.md)) — isso é requisito explícito do produto, não um polish de fase final.

## Personalização por papel (o que "hiperpersonalizado" significa aqui)

A estrutura modular já entrega isso por construção, não como feature separada: o shell resolve o papel do usuário (`useSession().role`) e monta a navegação/rotas disponíveis a partir disso — um aluno nunca carrega o bundle do módulo `admin`, um professor sem turma nenhuma vê o dashboard como um fluxo de "criar primeira turma" em vez da lista vazia de uma tabela. Cada módulo decide sua própria experiência vazia/inicial (ver [`EmptyState`](./design-system.md#componentes-do-design-system-packagesui) no design system) em vez de uma tela genérica "sem dados" repetida em todo lugar. Isso é "adaptável à necessidade do usuário" no sentido real do produto — dashboards diferentes por papel e por estado (zero turmas vs. 5 turmas vs. professor com exercícios no marketplace) — não um sistema de widgets arrastáveis/configuráveis manualmente, que não é um requisito que apareceu em nenhuma jornada mapeada.

## Fronteira com o backend

Zero mudança de contrato "porque o frontend quer" sem documentar o gap primeiro — toda necessidade nova de endpoint/tabela descoberta durante a implementação do frontend é especificada no módulo correspondente de [backend](../backend/overview.md) ou em [marketplace.md](./marketplace.md) (que já lista os gaps conhecidos hoje) antes de implementar, não depois. `runcodes-api` ganha o endpoint, `runcodes-web` consome — nunca o inverso (frontend inventando lógica de negócio que deveria estar no servidor).
