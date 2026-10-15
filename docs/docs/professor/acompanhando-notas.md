---
title: Acompanhando notas e submissões
sidebar_position: 4
---

# Acompanhando notas e submissões

Tudo nesta página é visão de staff (professor/assistente) — o aluno nunca vê os dados dos colegas.

## Matriz de notas da turma

Na página da turma, a aba de notas mostra a matriz **aluno × exercício**: cada célula traz a nota da submissão mais recente daquele aluno naquele exercício (vazio se nunca submeteu). A primeira coluna fica fixa no scroll horizontal, pra não perder de vista quem é a linha.

![matriz de notas aluno × exercício da turma, com a coluna de identificação fixa e várias colunas de exercício](/img/screenshots/prof-matriz-notas.png)

### Exportar CSV

**Exportar CSV** baixa a mesma matriz em planilha, incluindo a coluna com o **identificador institucional** de cada aluno (ex.: nº USP) — pronta pra cruzar com o sistema de notas da universidade. Quem nunca submeteu sai com nota 0.0.

## Estatísticas

- **Por exercício**: percentual de acerto **por caso de teste** (com base na submissão mais recente de cada aluno) — mostra exatamente qual caso está derrubando a turma; e a **matriz aluno × caso** ("quem passou em qual caso"), pro diagnóstico individual.
- **Por turma**: média da turma por exercício (dá pra sobrepor as notas de um aluno específico à média) e o infográfico agregado (nº de alunos, % com nota > 5, média geral).

![painel de estatísticas de um exercício com o gráfico de % de acerto por caso de teste](/img/screenshots/prof-stats-exercicio.png)

## Vendo o trabalho de um aluno

- **Histórico por aluno**: dentro do exercício, o histórico completo de submissões de cada aluno, com o código de cada envio.
- **Zip das submissões**: baixa a submissão **mais recente de cada aluno** do exercício, uma pasta por aluno — pra revisar offline, rodar análises próprias ou arquivar a entrega.

## Correção manual de nota

Em qualquer submissão, staff pode **sobrescrever nota e status** manualmente. Use quando:

- o corretor automático não cobre um critério (ex.: qualidade de código combinada em aula);
- um caso de teste estava errado e não vale a pena recompilar a turma inteira;
- exercícios de entrega de arquivo (correção manual é o único caminho de nota nesses).

Toda alteração fica registrada no log de auditoria da plataforma.

![diálogo de edição manual de nota/status de uma submissão](/img/screenshots/prof-editar-nota.png)

## Recompilação

Reprocessa submissões pelo corretor — útil depois de corrigir um caso de teste, um arquivo de compilação ou um gabarito:

- **Recompilar uma submissão** — reenfileira aquele envio específico; o resultado antigo é apagado e recalculado.
- **Recompilar o exercício** — reenfileira a submissão **mais recente de cada aluno** (não o histórico inteiro). É a ação certa depois de mudar a régua: todo mundo é reavaliado pelos casos atuais.

A plataforma avisa quando existem **"submissões desatualizadas"** — submissões avaliadas antes da última mudança nos casos de teste — pra você saber que a matriz de notas pode não refletir a régua atual.

:::tip Recompilar não altera o código de ninguém
A recompilação reavalia o que o aluno já enviou. O aluno vê o status voltar pra "na fila" e o resultado novo chegar em seguida — vale avisar a turma pra ninguém estranhar a nota mudando.
:::
