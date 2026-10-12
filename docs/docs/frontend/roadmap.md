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

## Fase 1 — Jornada do aluno (core) ✅

**Escopo:**
- Dashboard do aluno: turmas matriculadas, exercícios pendentes/recentes, atalho pra entrar em turma por código.
- Lista de exercícios de uma turma (com status: aberto/fechado/entregue/pendente).
- Detalhe de exercício: enunciado (markdown sanitizado), casos de teste visíveis (quando `show_input`/`show_expected_output` permitir), histórico de submissões próprias.
- Submissão via upload de arquivo (sem editor ainda — isso é Fase 2) + acompanhamento do resultado (polling até saír de `IN_QUEUE`, exibição por caso de teste).
- Notas: nota por exercício, matriz de notas da turma (visão do aluno é só a própria linha).
- Perfil básico.

**Critério de saída**: aluno faz o ciclo completo — entra na turma, vê exercício, submete, vê resultado, vê nota — sem precisar do `server` legado.

**Entregue.** Dois gaps reais de backend apareceram construindo isso e foram resolvidos antes da UI, não contornados no cliente:
- `GET /api/exercises/:id` não expunha os tipos de arquivo aceitos pelo exercício (só o catálogo admin completo) — sem isso, nem a UI nem a validação client-side de upload tinham como saber o que é aceito. Agora embute `allowedFiles`.
- `GET /api/offerings/:id` não trazia o status do aluno por exercício — sem isso a lista de exercícios precisaria de 1 request por exercício só pra saber "já entreguei isso?". Agora embute `myLatestCommit` por exercício (null se nunca submeteu), calculado numa única query, pulado inteiramente pra staff.

**Não entregue nesta fase** (não fazia parte do escopo, não é pendência): "Perfil básico" ficou pra quando houver algo de fato pra configurar ali — hoje a única informação de perfil (nome) já aparece no cabeçalho do dashboard; não parecia certo entregar uma tela de perfil vazia só pra marcar item. A matriz de notas completa da turma continua staff-only (como já era) — a visão do aluno hoje é o status por exercício no dashboard/turma, não uma tela de "notas" dedicada; revisitar se um aluno precisar ver o histórico de notas num formato diferente desse.

## Fase 2 — Editor de código (Monaco) ✅

**Escopo:** integração especificada em [code-editor.md](./code-editor.md) — editor como alternativa ao upload de arquivo na tela de submissão da Fase 1, com rascunho local, detecção de edição não salva, tema sincronizado. Inclui o gap de backend `GET /api/commits/:id/content` ([code-editor.md](./code-editor.md#get-apicommitsidcontent-)), sem o qual o editor não consegue pré-carregar a última submissão.

**Critério de saída**: aluno escreve e submete código sem nunca precisar de um editor externo, pros exercícios de 1 arquivo.

**Entregue**, verificado manualmente no browser (não só nos testes automatizados — Monaco não roda em jsdom, ver [testing.md](./testing.md)): pré-carregamento da última submissão, highlight de sintaxe, edição e reenvio funcionando contra o backend real. Duas descobertas reais no processo:
- **Web worker do Monaco não entrou** — o bundler deste projeto (Rolldown, via Vite 8) não resolve o specifier do worker por nenhum dos dois jeitos documentados pro Vite clássico (`?worker`, `new URL()+import.meta.url`); os dois quebram o build. Sem worker, o Monaco cai pra tokenização na thread principal — na prática zero diferença funcional, porque nenhuma linguagem do catálogo (Python, C, C++, Java, Makefile) tem *language service* baseado em worker no Monaco (só json/css/html/typescript têm). Documentado em `packages/editor/src/setup.ts`; revisitar se o Rolldown resolver isso ou se uma linguagem com language-service de worker entrar no catálogo.
- **Bug real em `Button asChild`**, achado só testando no browser de verdade: `{loading && <Spinner/>}` sempre ocupava uma posição nos children, e o Radix Slot exige exatamente 1 filho — todo botão `asChild` da aplicação (export pro Google Calendar, todo link "Ir pro login") quebrava com "Slot failed to slot onto its children". Corrigido, com teste de regressão. Reforça o motivo de [testing.md](./testing.md) ter um nível de verificação manual além do automatizado: esse bug não aparece em nenhum teste jsdom porque `asChild` com `loading=false` é exatamente o caminho que os testes existentes não cobriam.

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
