---
id: intro
title: Bem-vindo ao run.codes
sidebar_position: 1
---

# Bem-vindo ao run.codes

O run.codes é uma plataforma de **correção automática de exercícios de programação**. Funciona assim: o professor cadastra um exercício com casos de teste (entradas e saídas esperadas); você escreve seu código e submete; o sistema compila e executa sua solução num ambiente isolado, compara a saída com o gabarito, caso a caso, e devolve o resultado em segundos — quantas vezes você precisar, até o prazo.

## Por onde começar

O manual está organizado por papel. Vá direto pra seção que descreve o seu:

### Sou aluno

1. [Primeiros passos](./aluno/primeiros-passos.md) — criar conta, confirmar o email e entrar numa turma com o código do professor.
2. [Submetendo exercícios](./aluno/submetendo-exercicios.md) — enviar sua solução por upload de arquivo, prazos e tipos de arquivo aceitos.
3. [Usando o editor de código](./aluno/usando-o-editor.md) — escrever e submeter direto no navegador, inclusive projetos com mais de um arquivo.
4. [Entendendo o resultado](./aluno/entendendo-resultados.md) — o que significa cada status, o resultado por caso de teste e a nota.
5. [Erros de compilação e sinais](./aluno/erros-e-sinais.md) — o que fazer quando aparece "SIGSEGV", "tempo excedido" ou erro de compilação.

### Sou professor (ou monitor/assistente)

1. [Criando uma turma](./professor/criando-turma.md) — abrir uma turma de uma disciplina e convidar os alunos.
2. [Criando exercícios](./professor/criando-exercicios.md) — enunciado, prazos, linguagens aceitas e arquivos de apoio.
3. [Casos de teste](./professor/casos-de-teste.md) — como o corretor automático decide se a solução está certa.
4. [Acompanhando notas e submissões](./professor/acompanhando-notas.md) — matriz de notas, exportação em CSV, estatísticas, correção manual e recompilação.
5. [Marketplace de exercícios](./professor/marketplace.md) — reaproveitar exercícios publicados por outros professores.
6. [Detecção de plágio](./professor/deteccao-de-plagio.md) — comparar as submissões da turma entre si.

### Dúvidas rápidas

A [FAQ](./faq.md) responde as perguntas mais comuns dos dois papéis.

## Uma ideia que vale conhecer desde já

A nota no run.codes vem dos **casos de teste**: cada caso alimenta seu programa com uma entrada e compara a saída produzida com a saída esperada. A nota é proporcional aos casos corretos (10 × acertos ÷ total). Isso significa que "compilou e rodou no meu computador" não basta — a saída precisa bater **exatamente** com o esperado (salvo exercícios com comparação numérica tolerante). Grande parte deste manual existe pra te ajudar a entender e depurar essa diferença.
