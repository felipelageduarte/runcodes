---
title: Auditoria de paridade (out/2026)
sidebar_position: 0
---

# Auditoria de paridade legado → novo (out/2026)

Discovery completo, controller por controller do `server` (CakePHP) contra `runcodes-api`/`runcodes-web`, feito depois que a Fase 6 do [roadmap do frontend](../frontend/roadmap.md) foi dada como concluída. Motivação: suspeita de que algumas jornadas do legado não tinham sido cobertas — confirmada. Este documento é o registro de discovery; os itens que vão virar trabalho real estão nas fases novas do roadmap ([Fase 7 em diante](../frontend/roadmap.md#fase-7--fundação-do-catálogo-curso-e-turma-)).

Método: 4 auditorias independentes, uma por grupo de controllers, cada uma lendo o PHP + View legado, cruzando com rotas/services do `runcodes-api`, telas do `runcodes-web` e esta documentação antes de reportar qualquer coisa como gap (pra não reportar como "faltando" algo que já é decisão deliberada).

## Gaps reais, por criticidade

### Crítico — bloqueia uso real da plataforma

1. **Criar curso novo** (`CoursesController::add`) — sem rota, sem service, sem tela, em lugar nenhum do `runcodes-api`/`runcodes-web`. Catálogo de disciplinas só cresce hoje via SQL direto. Não estava em nenhum roadmap/backlog anterior — gap não reconhecido até esta auditoria.
2. **Criar oferta/turma** (`OfferingsController::add`) — sem rota/service/tela. Diferente do item 1, isso **já estava planejado** (Fase 3 do roadmap do frontend cita "Turma: criar"), mas nunca foi entregue — a Fase 3 real só cobriu gestão de turma *existente* (matrícula, CRUD de exercício/caso, stats, plágio). Sem o item 1 resolvido primeiro, criar turma não tem curso pra vincular.
3. **`editScore`** — professor não tem como sobrescrever nota/status de um commit manualmente. Sem isso, não existe correção manual/excepcional quando o corretor falha ou quando o caso pede julgamento humano.
4. **`recompile`/`recompileAll`** — sem reprocessar um commit específico ou todos os commits de um exercício depois de corrigir um bug no corretor ou nos casos de teste. Hoje, um bug no corretor corrigido depois da janela de entrega deixa todo mundo com a nota errada, sem recurso.

### Alto — perda de capacidade real, não documentada

5. **Desmatrícula "dura" por professor** (`EnrollmentsController::delete`) — hoje só admin remove aluno de turma, e só via `ban` (soft). No legado, o professor também conseguia desmatricular (remoção definitiva) um aluno da própria turma. Perda de autonomia do professor, não discutida em nenhum doc.
6. **Matrícula manual de outro usuário por staff/admin** (`EnrollmentsController::enroll`) — hoje matrícula só existe por autoatendimento via código; staff não tem como matricular alguém em nome dele (ex. aluno sem acesso à plataforma ainda).
7. **Editar turma** (`OfferingsController::edit`) — sem `PUT /offerings/:id`. Nem os campos básicos (`end_date`, `classroom`) de uma turma já criada podem ser mudados.
8. **Avisos (Alerts) invisíveis pro aluno** — o backend já suporta leitura de avisos ativos (`GET /alerts`, sem gate de staff), mas **nenhum componente do frontend consome isso fora da aba de gestão de staff**. Resultado: aluno nunca vê um aviso publicado por professor/admin. É o gap de melhor custo-benefício da lista — conserta só no frontend, zero trabalho de backend.
9. **Broadcast de email administrativo** (antigo `MessagesController`) — sistema inteiro ausente: admin manda email em massa pra grupos de usuários, com anexo, log de abertura (pixel de rastreio) e blacklist de quem não quer receber. Não aparece em nenhum backlog anterior — parece nunca ter sido considerado na migração, não uma decisão deliberada.
10. **Perfil do próprio usuário** (editar nome/senha/universidade/matrícula) — já estava no [backlog do backend](./backlog.md), mas é o item de maior impacto prático da lista inteira: hoje ninguém troca a própria senha ou corrige a matrícula depois do cadastro, pelo frontend.
11. **`addBatch` de casos de teste** — sem criação em lote via upload de pares de arquivo `.in`/`.out` casados por nome. Pra exercício com muitos casos de teste, o professor cria um por um na UI nova — regressão de produtividade real.
12. **`casesTable`** — falta a matriz aluno × caso de teste. Professor não vê rápido "quem passou em qual caso", só o agregado por caso (`StatsTab`).

### Médio

13. **Tela de catálogo de cursos (admin)** — a API (`GET /courses`, `GET /courses/:id`) já existe, mas nenhuma tela do `runcodes-web` consome isso, nem leitura.
14. **Aviso de "unsafe commits"** — sem alerta quando casos de teste são alterados depois que alunos já submeteram (risco de correção injusta sem o professor saber que a régua mudou no meio do jogo).
15. **Download/visualização de commit específico do histórico** — só o conteúdo da última submissão é exposto (e só pra pré-carregar o editor); não dá pra abrir/baixar uma submissão antiga específica.
16. **Clonar/importar exercício próprio** (diferente do fluxo de marketplace) — sem rota de "duplicar exercício já existente dentro da mesma ou outra turma reaproveitando casos/anexos", fora do fluxo de publicação pro catálogo público.
17. **Toggle de visibilidade em lote dos casos de teste** (mostrar/ocultar input/output/saída do aluno pra todos os casos de uma vez) — só individual hoje.
18. **`downloadCases`** — exportação em zip dos inputs/outputs dos casos de teste, sem equivalente.
19. **`removeAllCases`** — exclusão em lote de todos os casos de um exercício, sem equivalente (só individual).
20. **Painel de atividade global do admin** — o legado tinha visão de volume de submissões da plataforma inteira (hoje/ontem/7 dias, tendência de 28 dias por status); os stats novos só existem por turma/exercício, não há visão agregada da plataforma.
21. **Admin criar/apagar usuário manualmente** — já estava no [backlog do backend](./backlog.md), sem mudança de prioridade por essa auditoria.
22. **Email avulso do professor pra turma inteira** (`OfferingsController::email`) — sem equivalente, não documentado antes.
23. **Tradução de sinal de erro de compilação** (SIGSEGV, SIGKILL etc. → texto legível pro aluno) — não confirmado se sobreviveu na tela de resultado de commit; precisa verificação direta em `ExerciseStatusBadge`/tela de resultado antes de entrar como gap confirmado ou já coberto.

### Baixo / cosmético

24. Log administrativo global de commits (busca cross-turma por staff), export de exercício pro Google Calendar.
25. FAQ contextual no popup de login (`Questions::modal`).
26. Modo de manutenção (bloqueio de acesso exceto staff) e banner de "conta demo".
27. SSO LinkedIn/Google — já era código morto/obsoleto no próprio legado, sem prioridade.

## Decisões já documentadas — não são gaps novos

Confirmadas durante a auditoria, não geram trabalho novo:

- **Perfil de usuário e CRUD admin de usuário** (itens 10 e 21 acima) já estavam no backlog do backend antes desta auditoria — a novidade aqui é só a reavaliação de prioridade do item 10 pra "alto".
- **`ban` restrito a admin** — decisão deliberada ([enrollments.md](../backend/enrollments.md)), espelha o próprio legado (professor nunca podia banir, só desmatricular — que é o item 5 acima, uma ação *diferente*).
- **Logs sem filtro por tipo de ação/intervalo de data** — gap já conhecido e replicado de propósito, sem filtro no legado também.
- **Ticket sem thread de resposta** (editar sobrescreve mensagem em vez de anexar) — **não é regressão**: o legado nunca teve thread real, é uma linha única sobrescrita por `save()`. Paridade exata de uma limitação que já existia.
- **Abertura de ticket pelo aluno** — no legado em produção essa UI estava desabilitada (`if (1 == 2)` morto no template). A versão nova, com tela real de abrir chamado, é estritamente melhor que o comportamento real do legado.
- **Marketplace e catálogo de exercícios públicos abertos a qualquer aluno** — no legado isso era só pra professor/admin (`PublicExercisesController` restrito). Abrir pro aluno foi expansão deliberada já documentada em [marketplace.md](../frontend/marketplace.md), não gap de paridade — é superset intencional do legado.
- **`AlertsController` sem `isAuthorized` no legado** (qualquer autenticado podia publicar aviso) — já documentado como bug de permissão do legado corrigido na versão nova ([admin-and-support.md](../backend/admin-and-support.md)). O gap 8 desta lista é outra coisa: a *leitura* de avisos ativos não tem consumidor no frontend do aluno, isso não estava documentado.

## Próximos passos

Os itens críticos e altos (1-12) virão como novas fases do roadmap — ver [Fase 7 em diante](../frontend/roadmap.md#fase-7--fundação-do-catálogo-curso-e-turma-). Os itens médios (13-23) entram como fases subsequentes ou tarefas dentro delas quando compartilham tela/serviço. Os itens baixos (24-27) ficam registrados aqui, sem fase dedicada, pra entrar como ajuste pontual quando alguém estiver na área de código correspondente.
