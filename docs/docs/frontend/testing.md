---
title: Testes
sidebar_position: 7
---

# Estratégia de testes

Mesmo espírito de dois níveis já usado no `runcodes-api` ([backend testing.md](../backend/testing.md)): rápido e isolado primeiro, real e completo depois.

## Nível 1 — componente/unitário (Vitest + React Testing Library)

- Todo componente do design system (`packages/ui`) tem teste de comportamento (não de snapshot de HTML) — clica, foca, dispara evento esperado, respeita `disabled`/`aria-*`.
- Toda página de módulo testa os 4 estados obrigatórios: loading (skeleton renderiza), erro (mensagem + retry), vazio (empty state + CTA), sucesso (conteúdo real) — usando MSW pra simular as respostas da API sem rede real.
- Hooks de dados (`useExercise`, `useSubmitCommit`) testados isoladamente com `renderHook` + MSW.
- Roda em CI a cada push, sem depender de `runcodes-api` rodando.

## Nível 2 — E2E (Playwright, contra `runcodes-api` real)

Mesma filosofia do `full-flow.integration.test.ts` do backend: jornadas completas, infra real (ou um `runcodes-api` + `local-dev` subindo em CI), sem mock.

Jornadas mínimas cobertas:
1. Signup → confirmação de email (via API REST do `smtp4dev`, mesmo truque usado no teste de integração do backend) → login → acesso ao dashboard.
2. Entrar em turma por código → ver exercício → submeter via editor Monaco → ver resultado (polling até saír de `IN_QUEUE`) → ver nota na lista.
3. Professor cria exercício → cria caso de teste → publica no marketplace → (segunda sessão/contexto) outro professor descobre no marketplace, filtra por linguagem, adota pra sua turma → confirma que o exercício ghost aparece lá.
4. Fluxo de responsividade: mesma jornada 2 roda também em viewport mobile (Playwright suporta emulação de device) — garante que o "degrade pra desktop" do editor em mobile (ver [code-editor.md](./code-editor.md)) mostra a mensagem certa, não quebra.

## Nível 3 — visual/Storybook

Cada componente com story cobrindo todos os estados visuais documentados em [design-system.md](./design-system.md). Não é teste automatizado de regressão visual por padrão (custo de manter baselines de screenshot não se justifica ainda) — é ferramenta de revisão humana, mas fica pronta pra ligar Chromatic/Percy se o time achar necessário depois.

## Cobertura de responsividade

Toda PR que toca em layout roda o Storybook com os 3 breakpoints (mobile/tablet/desktop) como parte da revisão visual — não é um teste que passa/falha, é checklist de revisão, documentado aqui pra não depender de alguém lembrar.
