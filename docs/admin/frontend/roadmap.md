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

## Fase 3 — Jornada do professor/assistente ✅

**Escopo:**
- Gestão de turma: matrícula (código, lista de matriculados), promover/rebaixar, banir.
- CRUD de exercício (incluindo markdown no enunciado, anexos — `ExerciseFile`/`CompilationFile`).
- CRUD de caso de teste (texto inline + arquivo, via [`ExerciseCaseFile`](../backend/exercise-management.md#casos-de-teste-baseados-em-arquivo-exercisecasefile)).
- Compartilhamento direto de exercício entre turmas (ghost) — antes do marketplace existir, é o caminho manual que já funciona hoje.
- Dashboards: stats por caso de teste, histórico de commit por aluno, gráfico de média da turma, infográfico, export CSV, zip de submissões.
- Detecção de plágio: solicitar execução, acompanhar status, visualizar resultado (pares suspeitos, score de similaridade).

**Critério de saída**: professor consegue rodar uma disciplina inteira (criar turma → exercícios → casos → acompanhar entregas → notas → plágio) sem o `server` legado.

**Entregue.** Ressalva encontrada só na [auditoria de paridade de out/2026](../roadmap/gap-audit-2026-10.md), depois desta fase ter sido dada como concluída: "criar turma" do escopo acima, na prática, saiu como *gerenciar* turma existente (matrícula, CRUD de exercício/caso, stats, plágio) — `OfferingsController::add()` nunca foi implementado, nem `CoursesController::add()` (que nem estava no escopo original). Sem os dois, o sistema só funciona com cursos/turmas pré-semeados no banco. Fechado como [Fase 7](#fase-7--fundação-do-catálogo-curso-e-turma-).

## Fase 4 — Marketplace ✅

**Escopo:** especificado em [marketplace.md](./marketplace.md) — inclui os gaps de backend (coluna `created_at`, endpoint de busca/filtro/ordenação, `MarketplaceStatsService`) que precisam entrar no `runcodes-api` antes/junto da UI.

**Critério de saída**: professor descobre, filtra, ordena e adota um exercício de outro professor (mesma instituição ou não) sem conhecer o id de antemão.

**Entregue** — busca/filtro/ordenação e `MarketplaceStatsService` de dificuldade calculada, conforme especificado.

## Fase 5 — Admin e suporte ✅

**Escopo:**
- Admin: universidades, allowed-files, usuários, logs (leitura — já existe no backend).
- Tickets (abrir/acompanhar como usuário, gerenciar fila como staff), alerts (avisos), questions (FAQ), catálogo de public-exercises fora do fluxo de marketplace (se ainda fizer sentido como tela separada depois da Fase 4 existir).
- **"View as" (impersonação)** — existe no legado (`Users::viewAs()`), não existe no `runcodes-api` hoje. Gap de backend a especificar/implementar nesta fase: endpoint que emite token com papel efetivo rebaixado (nunca eleva privilégio) + registro em log de auditoria de cada troca (o legado não grava isso — achado do mapeamento de jornadas, não comportamento a replicar) + indicador visual permanente na UI enquanto ativo. Ver [journeys.md](./journeys.md#view-as-impersonação--existe-no-legado-não-existe-no-runcodes-api).

**Critério de saída**: paridade funcional completa com o `server` legado nos módulos administrativos/suporte.

**Entregue.** Ressalva da [auditoria de paridade de out/2026](../roadmap/gap-audit-2026-10.md): "paridade completa" não se confirmou em dois pontos que a auditoria de telas não pegou porque dependiam de ler o controller legado linha a linha, não só a tela nova — avisos ativos (`GET /alerts`) não tinham nenhum componente de frontend fora da aba de staff consumindo (aluno nunca via aviso), e o broadcast de email administrativo (antigo `MessagesController`) nunca entrou no escopo desta fase. Fechados como [Fase 9](#fase-9--comunicação-avisos-e-broadcast-).

## Fase 6 — Polimento e robustez ✅

**Escopo:**
- Auditoria de acessibilidade (navegação por teclado, leitor de tela) nas telas das fases 1-5.
- Code-splitting por rota (lazy load de módulo), auditoria de performance (Lighthouse, bundle size).
- Suite E2E completa (todas as jornadas críticas das fases anteriores).
- Revisão de dark mode em todas as telas (não só nas construídas na Fase 0).
- PWA (opcional — instalável em mobile, ajuda a jornada "degradada" do editor em telas pequenas a não parecer um site qualquer).

**Critério de saída**: produto pronto pra substituir o `server` legado como ponto de entrada principal dos usuários, com qualidade de produção em todos os eixos (não só funcional).

**Entregue** — a11y (padrão ARIA tablist nas abas, nomes acessíveis no breakpoint tablet do `AppShell`), suite E2E (Playwright, jornadas críticas de aluno/professor/admin), revisão de design (tokens, sidebar colorida, dashboard com cards de resumo). PWA não entrou — não tinha motivo concreto pra entrar, fica fora de escopo até aparecer um.

A auditoria de paridade de out/2026 ([discovery completo](../roadmap/gap-audit-2026-10.md)) encontrou gaps reais que as Fases 0-6 não cobriram, porque foram desenvolvidas tela por tela a partir da jornada principal, não controller por controller do legado. As fases abaixo fecham essa diferença, na ordem de criticidade do discovery.

## Fase 7 — Fundação do catálogo (curso e turma) ✅

**Escopo:**
- Backend: `POST /courses` (criar curso/disciplina, admin-only, com os mesmos campos do legado — universidade, código, título; cadastro em lote opcional, como o legado tinha). `POST /offerings` (criar turma, professor+, vínculo com curso + universidade do usuário, geração de código de matrícula único, email de confirmação pro criador). `PUT /offerings/:id` (editar `end_date`/`classroom`).
- Frontend: tela de criação de turma pro professor (fluxo "nova turma" → escolhe/busca curso existente ou, se universidade não tem o curso, pede pra um admin criar — ou admin cria curso inline, a decidir na especificação); tela de edição de turma; tela de catálogo de cursos read-only + CRUD pro admin (API já existe, só falta UI).
- Decisão de produto a resolver antes de especificar: professor pode criar curso novo sozinho (como o legado, que restringia a admin) ou só turma, pedindo curso a um admin? Afeta o desenho da tela de criação de turma.

**Critério de saída**: um admin cadastra uma disciplina nova e um professor abre uma turma nova pra ela, tudo pela UI nova, sem precisar de SQL direto nem depender de dados pré-semeados.

**Por que primeiro**: é o item crítico #1 e #2 do discovery — sem isso, o sistema novo só serve pra turmas que já existiam antes da migração.

**Entregue e verificado de ponta a ponta no browser real** (não só testes automatizados): `POST /courses` admin-only com checagem de código único por universidade; `POST /offerings` professor+ com validação server-side de que o curso pertence à mesma universidade do requisitante (o legado só escondia isso no dropdown, não validava no servidor — corrigido aqui), geração de código de matrícula único, auto-matrícula como professor, email de confirmação (confirmado chegando no smtp4dev com o código certo); `PUT /offerings/:id` restrito a staff da turma específica ou admin, só `classroom`/`endDate` editáveis, igual ao legado. Decisão tomada sobre a pergunta em aberto da especificação: criar curso continua admin-only (espelha o legado) — professor só escolhe entre cursos existentes da própria universidade; se a disciplina não existe, pede pra um admin cadastrar (mensagem explícita na tela de criar turma). Tela de catálogo de cursos (admin, leitura + criação) entrou junto, fechando também o item médio #13 do discovery.

## Fase 8 — Ferramentas de correção do professor ✅

**Escopo:**
- `editScore` — professor sobrescreve nota/status de um commit manualmente, com motivo registrado (auditoria de mutação já cobre isso de graça via middleware existente).
- `recompile` (um commit) e `recompileAll` (todo o exercício) — reenfileira pro `runcodes-compiler`.
- Aviso de "unsafe commits" — sinalizar no `GradesTab`/`StatsTab` quando casos de teste mudaram depois de alguma submissão já ter sido avaliada com a régua antiga.
- `casesTable` — matriz aluno × caso de teste (hoje só existe o agregado por caso).
- Criação em lote de casos de teste (upload de pares `.in`/`.out`), toggle de visibilidade em lote, exclusão em lote (`removeAllCases`), export em zip dos casos (`downloadCases`).
- Leitura de commit específico do histórico (não só o último).

**Critério de saída**: professor corrige um exercício inteiro — incluindo os casos excepcionais que o corretor automático não resolve — sem precisar abrir o banco ou pedir pra alguém do time de infra.

**Entregue e verificado de ponta a ponta** contra o `runcodes-compiler` real (não só mock): `PUT /commits/:id/score` (editScore), `POST /commits/:id/recompile` e `POST /exercises/:exerciseId/commits/recompile-all` — reenfileirar um commit de verdade fez o engine reprocessar, apagar os resultados de caso antigos e escrever nota/status novos, confirmado lendo o banco e os logs do worker. Matriz aluno × caso (`GET /exercises/:exerciseId/cases-table`) e aviso de "unsafe commits" (baseado em `exercise_cases.last_update`, sem mudança de schema) testados criando casos novos depois de uma submissão existente. Criação em lote (`POST /exercises/:exerciseId/cases/batch`) e toggle de visibilidade em lote (`PUT /exercises/:exerciseId/cases/visibility`) também validados no browser.

**Não entregue nesta fase**, adiado e depois fechado na [Fase 11](#fase-11--polimento-residual-): `downloadCases` (export em zip dos casos) e leitura de um commit específico do histórico pela UI.

## Fase 9 — Comunicação (avisos e broadcast) ✅

**Escopo:**
- Frontend: componente de avisos ativos visível a qualquer usuário autenticado (banner/widget no `AppShell` ou `DashboardPage`), consumindo o endpoint `GET /alerts` que **já existe** no backend — este item não precisa de nenhum trabalho de API, só de tela.
- Backend + frontend: broadcast de email administrativo — admin manda mensagem (com anexo opcional) pra um grupo de usuários (por universidade/turma/todos), com histórico de envios. Decisão de escopo a tomar: portar o pixel de rastreio de abertura e a blacklist de endereços do legado, ou simplificar pra só envio + histórico (sem tracking) — rastreio de abertura por pixel tem implicação de privacidade que o legado não tratava bem.

**Critério de saída**: um aviso publicado por staff aparece pra qualquer aluno logado; admin manda uma comunicação em massa sem precisar de acesso a banco/SMTP direto.

**Entregue e verificado de ponta a ponta** (browser real + smtp4dev): `AlertsBanner` no `AppShell` consome `GET /alerts` (zero trabalho de backend, confirmado) — criei um aviso como admin, deslogei, logei como aluno, o banner apareceu; dispensar persiste por `localStorage` (por navegador, não lição marcada como lida pro back). Broadcast de email: decisão de escopo tomada — sem pixel de rastreio, sem blacklist, sem anexo; migração `006_add_broadcast_fields_to_messages.sql` adiciona `sender_email`/`sent_at`/`recipient_count` à tabela `messages` legada (reaproveitada em vez de criar tabela nova) pra servir de histórico self-contained. Audiência por papel (`students`/`staff`/`admins`/`all`) — achei e corrigi um bug real durante a verificação manual: a implementação inicial resolvia "Alunos" como `type >= STUDENT`, que em uma escala onde aluno é o tipo mais baixo inclui todo mundo; corrigido pra faixa exata (`[STUDENT, STUDENT]`), com teste de regressão. Confirmado no smtp4dev: selecionar "Alunos" manda só pro único aluno confirmado da base de teste, não pro admin que fez o disparo.

## Fase 10 — Gestão de turma avançada ✅

**Escopo:**
- Desmatrícula "dura" de aluno pelo próprio staff da turma (diferente de `ban`, que continua admin-only).
- Matrícula manual de outro usuário por staff/admin (sem depender do aluno digitar o código).
- Email avulso do professor pra todos os matriculados na turma.
- Perfil do próprio usuário (editar nome/senha/universidade/matrícula) — rota `/me` + tela, maior item de impacto prático do backlog represado.
- CRUD completo de usuário por admin (criar/apagar, além da edição que já existe).

**Critério de saída**: professor tem o mesmo controle sobre a própria turma que tinha no legado; qualquer usuário consegue trocar a própria senha sem precisar de um admin.

**Entregue e verificado de ponta a ponta no browser real.** Diferenças decididas durante a implementação:
- **Desmatrícula "dura"** e **matrícula manual** — o legado restringia `enroll` a admin-only (não está em `professorAuthorized` nem `studentAuthorized`); aqui segue a mesma régua de `delete`/`setRole` (staff da turma específica ou admin) — adicionar alguém matriculado é a mesma categoria de ação que já gerenciar quem está lá, não motivo pra exigir admin. Testado: matriculei e desmatriculei um usuário de teste numa turma real, toast de confirmação e lista atualizam na hora.
- **Email pra turma inteira** — `POST /offerings/:id/email`, mesma régua de staff-ou-admin, filtra membros banidos (o legado não filtrava — mandava pra quem já tinha sido removido da turma). Testado via smtp4dev: 2 destinatários reais, assunto com prefixo `[run.codes - <curso>]`.
- **Perfil do usuário** — `GET/PUT /users/me` (nome/universidade/matrícula) e `PUT /users/me/password` (verifica a senha atual com o mesmo caminho de `AuthService.login()`, incluindo migração transparente de hash sha1 legado pra bcrypt). Testado: troquei a senha do zero, errei a senha atual de propósito (erro correto), acertei, revertido ao estado original no final do teste.
- **CRUD completo de admin de usuário** — `POST /admin/users` (cria já confirmado, sem round-trip de email, mirrors `UsersController::insert()`) e `DELETE /admin/users/:email` (hard delete, cascata via FK). Testado: criei e removi um usuário de teste pela UI, confirmação com AlertDialog antes de apagar.

## Fase 11 — Polimento residual ✅

**Escopo** (itens médios/baixos do discovery, sem tela/serviço compartilhado com as fases acima, agrupados só por não valerem fase própria):
- `downloadCases` (export em zip dos inputs/outputs dos casos de teste) — adiado da Fase 8.
- Leitura de um commit específico do histórico pela UI (não só o mais recente) — o endpoint já aceita qualquer commit do dono/staff, falta só a tela; adiado da Fase 8.
- Painel de atividade global do admin (volume de submissões da plataforma inteira).
- Clonar/importar exercício próprio (fora do fluxo de marketplace).
- Tradução de sinal de erro de compilação pro aluno — primeiro confirmar se já existe (não confirmado no discovery), só então decidir se é trabalho novo.
- Log administrativo global de commits, export de exercício pro Google Calendar, FAQ contextual no popup de login — baixa prioridade, entram como ajuste pontual quando alguém estiver na área de código correspondente, não precisam de sprint dedicado.

**Critério de saída**: nenhum item do [discovery de paridade](../roadmap/gap-audit-2026-10.md) continua em aberto sem decisão registrada (feito, planejado, ou descartado deliberadamente).

**Entregue e verificado de ponta a ponta no browser real** (admin + aluno):
- `downloadCases` — `GET /exercises/:id/cases/download.zip`, staff baixa tudo, aluno só o que tem `showInput`/`showExpectedOutput` marcado. Testado via curl (zip real, `README.txt` + `N.in`/`N.out`) e o link aparece tanto na aba de casos do professor quanto na tela do aluno.
- **Leitura de commit específico do histórico** — cada `CommitCard` ganhou "Ver código enviado" sob demanda. Testado abrindo duas submissões diferentes do mesmo exercício: cada uma mostra seu próprio arquivo/conteúdo real (`solution.py` vs `solucao.py`, código diferente), não só a mais recente.
- **Tradução de sinal de compilação** (item 23 — confirmado como gap real, não só "não confirmado"): `compiledSignal` nunca tinha sido exposto pela API; agora `CommitRecord` carrega o campo e `CommitCard` traduz sinais comuns (SIGSEGV, SIGABRT, SIGFPE etc.) pra uma frase em pt-BR quando o commit termina em erro, junto com a saída bruta do compilador (`compiledMessage`, que também nunca tinha UI nenhuma antes disso).
- **Clonar exercício próprio** — `POST /exercises/:id/clone`, cópia independente (não ghost): duplica enunciado + casos de teste com conteúdo próprio no S3 (hash diferente do original, confirmado). Anexos (`ExerciseFile`/`CompilationFile`) não são clonados — decisão de escopo, reanexar é o mesmo esforço de autoria de qualquer forma.
- **Painel de atividade global do admin** — `GET /admin/stats/activity`, hoje/ontem/últimos 7 dias + gráfico de 28 dias, agregado em memória a partir de `commits.commit_time` (mesmo trade-off de escala que o `MarketplaceStatsService` já assume). Achado e corrigido um bug real durante a verificação visual: a classe `bg-primary-400` não existe na paleta de cores (só 50/100/300/500/600/700), o gráfico renderizava sem nenhuma barra visível — corrigido pra `bg-primary-500`.
- **Export pro Google Calendar** (item 24) — já estava implementado desde a Fase 2 (`googleCalendarUrl` em `ExercisePage.tsx`); a lista de pendências desatualizou isso, corrigido aqui.

**Deliberadamente não implementado**, baixa prioridade confirmada (sem mudança de decisão): log administrativo global de commits (busca cross-turma por staff) e FAQ contextual no popup de login — nenhum dos dois tem sprint dedicado, entram como ajuste pontual se alguém estiver na área de código correspondente no futuro.

## Fora de escopo deste roadmap

- Jupyter Notebook — explicitamente descartado por agora (decisão do usuário nesta rodada de planejamento).
- `code-server`/VS Code completo — ver [code-editor.md](./code-editor.md#decisão-monaco-editor-não-code-server).
- Microfrontends com deploy independente de verdade — a arquitetura está pronta pra isso (ver [overview.md](./overview.md#por-que-spa-modular-e-não-microfrontends-de-verdade-ainda)), mas não é uma fase planejada sem um motivo concreto (times paralelos, release independente) aparecer.
- **Login social (Google/LinkedIn)** — existe no legado (`UsersController::googleCallback()`/`linkedin()`), não existe no `runcodes-api`. Não entra em nenhuma fase até existir decisão de produto sobre manter dois provedores OAuth — documentado em [journeys.md](./journeys.md#jornada-de-entrada), não planejado.
