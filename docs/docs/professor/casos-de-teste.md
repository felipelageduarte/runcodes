---
title: Casos de teste
sidebar_position: 3
---

# Casos de teste

Os casos de teste **são** a correção: cada caso define uma entrada, a saída esperada e os limites de execução. A nota do aluno é `10 × casos corretos ÷ total`. Esta página cobre como criá-los bem.

## Criando um caso

Na página do exercício (visão de staff), aba de casos de teste:

- **Entrada** — o texto alimentado ao programa do aluno pela entrada padrão (stdin).
- **Saída esperada** — o gabarito, comparado com a saída do programa (stdout).
- **Tipo de comparação**:
  - **Texto exato** — padrão; cada caractere conta.
  - **Texto tolerante** — ignora diferenças de espaçamento em branco no fim de linha.
  - **Numérica** — compara números com uma **margem de erro absoluta** que você define (essencial pra ponto flutuante).
- **Limites** — **tempo de CPU** (por caso) e memória. O limite de tempo é a defesa contra loop infinito: aperte-o pro algoritmo esperado, com folga pro overhead (um caso que a solução de referência resolve em 0,1s pode ter limite de 1s, não de 10s).
- **Visibilidade** — três chaves independentes, por caso: mostrar **entrada**, mostrar **saída esperada**, mostrar **saída do aluno**.

![formulário de caso de teste com entrada, saída esperada, tipo de comparação, limites e as três chaves de visibilidade](/img/screenshots/prof-novo-caso.png)

### Arquivos de caso

Um caso pode ter **arquivos anexados** — pra exercícios em que o programa lê um arquivo de dados em vez de (ou além de) stdin. Os arquivos do caso ficam no diretório de execução junto do programa do aluno. Esses arquivos nunca são visíveis ao aluno (são material de correção).

## Estratégia de visibilidade

Um arranjo que funciona bem:

- **2–3 casos públicos** (entrada e saída esperada visíveis) — são os exemplos "de verdade", em que o aluno se apoia pra entender o formato e depurar.
- **Casos ocultos** cobrindo bordas (entrada vazia, valores extremos, caso grande de desempenho) — evitam solução decorada pro gabarito.
- **Mostrar a saída do aluno** nos casos públicos ajuda muito a depuração (o aluno compara lado a lado); nos ocultos, mantenha desligado.

Dá pra alterar a visibilidade de **todos os casos de uma vez** (ação em lote), além de caso a caso.

## Criação em lote

Pra exercícios com muitos casos, use **criar em lote**: cole vários pares entrada/saída de uma vez, com configuração compartilhada (comparação, limites, visibilidade). Também existem ações de **apagar todos os casos** e **baixar todos em zip** (numerados `1.in`/`1.out`, `2.in`/`2.out`...) — o zip é a forma prática de versionar os casos fora da plataforma.

![diálogo de criação de casos em lote com vários pares entrada/saída e a configuração compartilhada](/img/screenshots/prof-casos-lote.png)

## Armadilhas clássicas

- **Espaço ou quebra de linha sobrando no gabarito** — o aluno certo recebe "Incorreto" e ninguém entende por quê. Confira o fim de cada linha da saída esperada; na dúvida, use comparação tolerante.
- **Gabarito gerado por uma solução errada** — sempre gere as saídas esperadas rodando a sua solução de referência (idealmente pela própria plataforma: submeta a referência e compare).
- **Ponto flutuante com comparação exata** — `0.1 + 0.2` não é `0.3`. Use comparação numérica com margem.
- **Limite de tempo largo demais** — um caso de desempenho com limite frouxo aprova o algoritmo O(n²) que você queria reprovar.
- **Mudar casos no meio da janela de entrega** — pode; mas as submissões antigas ficam avaliadas pela régua velha até você [recompilar](./acompanhando-notas.md#recompilação). A plataforma sinaliza isso como "submissões desatualizadas" na matriz de resultados.
