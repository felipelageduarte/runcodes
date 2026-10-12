---
title: Roadmap de implementação (fases)
sidebar_position: 8
---

# Roadmap de implementação

Cada fase é implementável e testável isoladamente — entrega valor real, não é só "andaime pra próxima fase". Ordem pensada pelo caminho crítico do produto: sem auth e sem o aluno conseguir submeter código, nada mais importa; marketplace e admin só fazem sentido depois que o core dos dois papéis principais (aluno, professor) está de pé.

## Fase 0 — Fundação ✅

**Escopo:**
- Estrutura de módulos (`app/`, `modules/*`, `packages/ui`, `packages/api-client`, `packages/auth`) conforme [overview.md](./overview.md).
- Design system inicial: tokens (cor, espaço, tipografia — claro/escuro), Button, Input, Card, Dialog, AlertDialog, Toast, Table, Skeleton, EmptyState, Badge — o suficiente pra montar qualquer tela das fases seguintes sem parar pra criar componente novo toda hora.
- `AppShell` responsivo (sidebar desktop/tablet, bottom-nav mobile) com navegação vazia (placeholder por módulo).
- `packages/auth`: `AuthProvider`, `useSession`, decisão de storage do token resolvida ([security.md](./security.md) — idealmente já migrando para cookie `httpOnly` nesta fase, é o momento mais barato de trocar, antes de qualquer outro código depender de `localStorage`).
- Módulo `auth`: login, signup, confirmação de email, reenvio, reset de senha — telas completas, consumindo os endpoints já existentes no `runcodes-api`.
- Setup de testes (Vitest + RTL + MSW, Playwright básico, Storybook).

**Critério de saída**: um usuário consegue se cadastrar, confirmar email, logar, deslogar, recuperar senha — tudo pela UI nova, zero dependência do `server` legado nessas telas.

**Entregue.** Diferenças do que estava especificado, decididas durante a implementação:
- O token httpOnly ([security.md](./security.md)) exigiu mudança no `runcodes-api`, não só no frontend: `POST /api/auth/login` agora também seta o cookie (mantendo o token no corpo, pra scripts/testes que ainda usam `Authorization`), mais `GET /api/auth/me` (rehydration de sessão no reload) e `POST /api/auth/logout` — nenhum dos três existia antes desta fase.
- React Router é só roteamento/code-splitting (`lazy()` por rota) — TanStack Query é a única camada de dados, resolvendo a ambiguidade apontada na revisão do SDD.
- `editor/` e `shared/` entraram como `packages/*` desde o início (não como `modules/*`), já com a correção de fronteira da revisão do SDD aplicada em código, não só em doc.
- Resend/reset-password mostram erro real em 404 (conta não existe) em vez de uma tela de "enviado" genérica — o backend não esconde existência de conta nesses dois endpoints, então a UI também não finge esconder.

## Fase 1 — Jornada do aluno (core)

**Escopo:**
- Dashboard do aluno: turmas matriculadas, exercícios pendentes/recentes, atalho pra entrar em turma por código.
- Lista de exercícios de uma turma (com status: aberto/fechado/entregue/pendente).
- Detalhe de exercício: enunciado (markdown sanitizado), casos de teste visíveis (quando `show_input`/`show_expected_output` permitir), histórico de submissões próprias.
- Submissão via upload de arquivo (sem editor ainda — isso é Fase 2) + acompanhamento do resultado (polling até saír de `IN_QUEUE`, exibição por caso de teste).
- Notas: nota por exercício, matriz de notas da turma (visão do aluno é só a própria linha).
- Perfil básico.

**Critério de saída**: aluno faz o ciclo completo — entra na turma, vê exercício, submete, vê resultado, vê nota — sem precisar do `server` legado.

## Fase 2 — Editor de código (Monaco)

**Escopo:** integração especificada em [code-editor.md](./code-editor.md) — editor como alternativa ao upload de arquivo na tela de submissão da Fase 1, com rascunho local, detecção de edição não salva, tema sincronizado. Inclui o gap de backend `GET /api/commits/:id/content` ([code-editor.md](./code-editor.md#gap-de-backend-não-existe-endpoint-pra-ler-o-conteúdo-de-um-commit)), sem o qual o editor não consegue pré-carregar a última submissão.

**Critério de saída**: aluno escreve e submete código sem nunca precisar de um editor externo, pros exercícios de 1 arquivo.

## Fase 3 — Jornada do professor/assistente

**Escopo:**
- Gestão de turma: matrícula (código, lista de matriculados), promover/rebaixar, banir.
- CRUD de exercício (incluindo markdown no enunciado, anexos — `ExerciseFile`/`CompilationFile`).
- CRUD de caso de teste (texto inline + arquivo, via [`ExerciseCaseFile`](../backend/exercise-management.md#casos-de-teste-baseados-em-arquivo-exercisecasefile)).
- Compartilhamento direto de exercício entre turmas (ghost) — antes do marketplace existir, é o caminho manual que já funciona hoje.
- Dashboards: stats por caso de teste, histórico de commit por aluno, gráfico de média da turma, infográfico, export CSV, zip de submissões.
- Detecção de plágio: solicitar execução, acompanhar status, visualizar resultado (pares suspeitos, score de similaridade).

**Critério de saída**: professor consegue rodar uma disciplina inteira (criar turma → exercícios → casos → acompanhar entregas → notas → plágio) sem o `server` legado.

## Fase 4 — Marketplace

**Escopo:** especificado em [marketplace.md](./marketplace.md) — inclui os gaps de backend (coluna `created_at`, endpoint de busca/filtro/ordenação, `MarketplaceStatsService`) que precisam entrar no `runcodes-api` antes/junto da UI.

**Critério de saída**: professor descobre, filtra, ordena e adota um exercício de outro professor (mesma instituição ou não) sem conhecer o id de antemão.

## Fase 5 — Admin e suporte

**Escopo:**
- Admin: universidades, allowed-files, usuários, logs (leitura — já existe no backend).
- Tickets (abrir/acompanhar como usuário, gerenciar fila como staff), alerts (avisos), questions (FAQ), catálogo de public-exercises fora do fluxo de marketplace (se ainda fizer sentido como tela separada depois da Fase 4 existir).
- **"View as" (impersonação)** — existe no legado (`Users::viewAs()`), não existe no `runcodes-api` hoje. Gap de backend a especificar/implementar nesta fase: endpoint que emite token com papel efetivo rebaixado (nunca eleva privilégio) + registro em log de auditoria de cada troca (o legado não grava isso — achado do mapeamento de jornadas, não comportamento a replicar) + indicador visual permanente na UI enquanto ativo. Ver [journeys.md](./journeys.md#view-as-impersonação--existe-no-legado-não-existe-no-runcodes-api).

**Critério de saída**: paridade funcional completa com o `server` legado nos módulos administrativos/suporte.

## Fase 6 — Polimento e robustez

**Escopo:**
- Auditoria de acessibilidade (navegação por teclado, leitor de tela) nas telas das fases 1-5.
- Code-splitting por rota (lazy load de módulo), auditoria de performance (Lighthouse, bundle size).
- Suite E2E completa (todas as jornadas críticas das fases anteriores).
- Revisão de dark mode em todas as telas (não só nas construídas na Fase 0).
- PWA (opcional — instalável em mobile, ajuda a jornada "degradada" do editor em telas pequenas a não parecer um site qualquer).

**Critério de saída**: produto pronto pra substituir o `server` legado como ponto de entrada principal dos usuários, com qualidade de produção em todos os eixos (não só funcional).

## Fora de escopo deste roadmap

- Jupyter Notebook — explicitamente descartado por agora (decisão do usuário nesta rodada de planejamento).
- `code-server`/VS Code completo — ver [code-editor.md](./code-editor.md#decisão-monaco-editor-não-code-server).
- Microfrontends com deploy independente de verdade — a arquitetura está pronta pra isso (ver [overview.md](./overview.md#por-que-spa-modular-e-não-microfrontends-de-verdade-ainda)), mas não é uma fase planejada sem um motivo concreto (times paralelos, release independente) aparecer.
- **Login social (Google/LinkedIn)** — existe no legado (`UsersController::googleCallback()`/`linkedin()`), não existe no `runcodes-api`. Não entra em nenhuma fase até existir decisão de produto sobre manter dois provedores OAuth — documentado em [journeys.md](./journeys.md#jornada-de-entrada), não planejado.
