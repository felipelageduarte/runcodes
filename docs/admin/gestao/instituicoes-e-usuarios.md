---
title: Instituições e usuários
sidebar_position: 1
---

# Gestão de instituições e usuários

Tarefas do painel administrativo (requer `type >= 3`). As rotas de API correspondentes estão detalhadas em [admin-and-support](../backend/admin-and-support.md).

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

- **Tickets**: qualquer autenticado abre; a fila global é gerenciada por assistente+ (`type >= 1`) — resolver, fechar, responder.
- **Avisos (alerts)**: publicados por staff+, aparecem como banner pra todos os usuários logados. Publicação exige staff (no legado qualquer autenticado conseguia — corrigido na migração).
- **FAQ (questions)**: catálogo editado por admin, leitura pública.
