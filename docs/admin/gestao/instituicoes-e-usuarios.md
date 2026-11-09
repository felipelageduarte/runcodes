---
title: Instituições e usuários
sidebar_position: 1
---

# Gestão de instituições e usuários

Tarefas do painel administrativo (requer `type >= 3`). As rotas de API correspondentes estão detalhadas em [admin-and-support](../backend/admin-and-support.md).

## Visão geral (`/admin`)

A home do admin mostra, antes de qualquer aba, o que um operador precisa saber: commits na fila, commits
presos em compilação/execução há mais de N minutos (seletor de 5 a 60 min, default 15), erros de
compilação e do servidor nas últimas 24 h, contas por tipo, tickets abertos, avisos ativos, o volume de
submissões (hoje/ontem/7 dias) e a saúde do banco (conexões, tamanho, uptime). Os números vêm de
`GET /api/admin/overview`, cacheado 30 s no servidor; o rodapé diz a hora da leitura e tem "Atualizar".
Quando não há nada na fila, nenhum commit preso e nenhum erro do servidor, a tela diz "Pipeline em dia".
Commit preso é o sinal de container travado: o detalhe por commit fica em Pipeline
([troubleshooting](../troubleshooting.md)).

## Universidades (instituições)

O sistema é multi-tenant por universidade: toda conta e toda turma pertencem a uma. Regras que derivam disso:

- Um aluno **só entra em turmas da própria universidade** (o código de matrícula falha com "universidade diferente").
- O **identificador institucional** (ex.: "NUSP") é configurado por universidade e sai na exportação CSV de notas.

Gestão: painel admin → Universidades (criar/editar; a **abreviação é única**). Listagem é pública (o formulário de cadastro precisa dela antes do login).

## Disciplinas (courses)

Criar disciplina é **admin-only** (decisão deliberada, espelha o legado): o professor escolhe uma disciplina existente da universidade dele ao criar turma; se não existe, pede a um admin. Painel admin → Catálogo de cursos (código único por universidade). Sem isso, professores da instituição não conseguem abrir turmas novas.

## Usuários

Painel admin → Usuários:

- **Listar/filtrar e editar** qualquer conta — incluindo `type` (promover a professor/admin) e `confirmed`. Promoção de papel global é **sempre** ação de admin; signup cria todo mundo como aluno.
- **Criar conta já confirmada** — sem round-trip de email (útil pra contas institucionais/professores novos).
- **Apagar conta** — hard delete com cascata via FK: **matrículas e submissões somem junto, sem desfazer**. Confirme duas vezes.

Papéis globais (`users.type`): 0 aluno, 1 assistente, 2 professor, 3 admin, 4 developer. Não confundir com o papel **por turma** (`enrollments.role`) — um `type=0` pode ser professor de uma turma específica.

### Ações sobre matrícula que só admin faz

- **Banir** um membro de uma turma (soft — bloqueia rematrícula). Professor/assistente desmatricula ("hard"), mas não bane.

## Broadcast de email

Painel admin → Mensagens: envia email pra uma audiência por papel (`students` / `staff` / `admins` / `all`), com histórico de envios (quem mandou, quando, quantos destinatários). Deliberadamente **sem** pixel de rastreio de abertura, blacklist ou anexo. Envio é best-effort por destinatário — um endereço inválido não derruba o lote.

## Suporte (tickets) e avisos

- **Tickets**: qualquer autenticado abre; a fila global é gerenciada por assistente+ (`type >= 1`) — resolver, fechar, responder. Staff usa a aba "Fila" em `/suporte`; o admin tem a mesma fila em **Administração → Tickets** (`/admin/tickets`).
- **Avisos (alerts)**: publicados por staff+, aparecem como banner pra todos os usuários logados. Publicação exige staff (no legado qualquer autenticado conseguia — corrigido na migração). Admin gerencia em **Administração → Avisos** (`/admin/avisos`); staff, na aba "Avisos" de `/suporte`.
- **FAQ (questions)**: catálogo editado por admin, leitura pública.
