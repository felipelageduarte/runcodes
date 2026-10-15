---
title: Criando exercícios
sidebar_position: 2
---

# Criando exercícios

## O formulário de exercício

Na página da turma, **Novo exercício**. Os campos que importam:

- **Título e enunciado** — o enunciado aceita **Markdown** (código, listas, tabelas, imagens). Descreva com precisão o formato de entrada e saída: a correção compara a saída do aluno caractere a caractere, então todo detalhe do formato que você não especificar vira caso de "Incorreto" injusto.
- **Tipo do exercício**:
  - **Código (compilável)** — o fluxo padrão: o aluno submete código, o sistema compila, roda os [casos de teste](./casos-de-teste.md) e dá a nota.
  - **Arquivo (correção manual)** — o aluno entrega um arquivo (ex.: relatório em PDF) e você [dá a nota manualmente](./acompanhando-notas.md#correção-manual-de-nota). Sem casos de teste.
- **Datas** — **abertura** (quando o aluno passa a poder submeter) e **deadline**. Com "mostrar antes de abrir", o aluno vê o enunciado antes da abertura, mas só submete depois dela. Staff da turma submete a qualquer momento (pra testar o próprio exercício).
- **Tipos de arquivo aceitos** — as extensões que o exercício aceita (`.c`, `.py`, `.zip`...). É isso que define a linguagem de compilação/execução. Aceite `.zip` quando quiser permitir projetos multi-arquivo com `Makefile`.
- **Limites** — tempo de CPU e memória valem **por caso de teste** e são configurados neles (ver [casos de teste](./casos-de-teste.md)).

![formulário de criação de exercício com enunciado em markdown, datas, e seleção de tipos de arquivo aceitos](/img/screenshots/prof-novo-exercicio.png)

## Arquivos do exercício

Dois tipos de anexo, com papéis diferentes:

- **Arquivos de apoio** (`exercise files`) — materiais que o **aluno baixa**: enunciado em PDF, exemplos, datasets. Visíveis pra qualquer matriculado.
- **Arquivos de compilação** (`compilation files`) — arquivos que entram **na compilação/execução** do código do aluno, sem que ele os envie: um `main.c` de teste que chama as funções do aluno, um header fixo, uma biblioteca da disciplina. É o mecanismo pra exercícios do tipo "implemente apenas as funções X e Y".

![seção de anexos do exercício mostrando as duas listas separadas — arquivos de apoio e arquivos de compilação](/img/screenshots/prof-anexos-exercicio.png)

## Testando o próprio exercício

Antes de abrir pros alunos: **submeta você mesmo uma solução de referência**. Staff pode submeter mesmo com o exercício fechado — é a forma mais barata de descobrir caso de teste com gabarito errado, limite de tempo apertado demais ou enunciado ambíguo. Se a sua solução oficial não tira 10, nenhum aluno vai tirar.

## Reaproveitando exercícios

- **Compartilhar com outra turma** (clone vinculado) — o exercício aparece na outra turma como um **clone vinculado** ("ghost"): enunciado, casos de teste e anexos continuam sendo os do original — editar os casos do original afeta todas as turmas que o usam. Datas e janela de abertura são próprias de cada turma. Use pra rodar a mesma lista em turmas paralelas do mesmo semestre.
- **Clonar como cópia independente** — duplica o exercício (enunciado, tipos de arquivo e casos de teste com conteúdo próprio); a cópia nasce com o título "(cópia)" e vida separada — editar um não afeta o outro. **Anexos não são copiados** — reanexe o que precisar. Use pra evoluir uma lista de um semestre pro outro.
- **Marketplace** — publicar o exercício pro catálogo entre professores, ou adotar um publicado por outro professor. Ver [Marketplace](./marketplace.md).

:::warning Mudou os casos depois que alunos já submeteram?
A plataforma avisa ("submissões desatualizadas") quando existem submissões avaliadas com uma régua antiga. Use **recompilar** pra reavaliar todo mundo com os casos novos — ver [Acompanhando notas](./acompanhando-notas.md#recompilação).
:::
