---
title: Detecção de plágio
sidebar_position: 6
---

# Detecção de plágio

A plataforma compara as submissões da turma entre si usando ferramentas de análise de similaridade de código (**Dolos** e **JPlag** — as mesmas usadas em universidades no mundo todo). Elas analisam a **estrutura** do código, não o texto: renomear variáveis, trocar comentários ou reordenar funções não engana a análise.

## Rodando uma análise

1. Na página do exercício (visão de staff), abra a aba de plágio e clique em **Nova análise**, escolhendo a ferramenta (Dolos ou JPlag — na dúvida, rode as duas: concordância entre elas é um sinal forte).
2. A análise compara a **submissão mais recente de cada aluno** do exercício, em todos os pares. Ela roda em segundo plano — pra turmas grandes pode levar alguns minutos (a comparação é todos-contra-todos).
3. O resultado lista os **pares de alunos** ordenados por **índice de similaridade** (0 a 1).

![aba de plágio de um exercício com uma análise concluída listando pares de alunos e score de similaridade](/img/screenshots/prof-plagio-resultado.png)

## Lendo o resultado

:::warning Similaridade é sinal, nunca veredito
A ferramenta aponta **pares pra revisão humana** — a decisão é sempre sua. Antes de qualquer acusação:

- **Exercícios triviais** ("Hello World", fórmulas de uma linha) têm pouquíssimas formas de serem escritos — similaridade alta ali não significa nada.
- **Código dado em aula** (template da disciplina, trechos do enunciado) aparece igual em todo mundo, legitimamente.
- Abra as **duas submissões lado a lado** (o histórico por aluno dá acesso ao código de cada envio) e julgue: a semelhança está na parte criativa da solução ou no boilerplate?
:::

Valores de referência: pares com similaridade ~1.0 em exercícios não-triviais merecem atenção imediata; a faixa intermediária depende totalmente do exercício — compare com a distribuição da turma (se todo mundo está em 0.3 e um par está em 0.9, o contraste é o sinal).

## Depois da decisão

Confirmado o plágio (pelos critérios da sua disciplina/instituição), você pode marcar a submissão com o status **Plágio** — o aluno vê o status e a nota correspondente na turma. A marcação é manual e reversível ([correção manual](./acompanhando-notas.md#correção-manual-de-nota)), e fica registrada no log de auditoria.
