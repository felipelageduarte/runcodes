---
title: Submetendo exercícios
sidebar_position: 2
---

# Submetendo exercícios

## A página do exercício

Abra a turma e clique num exercício. A página mostra:

- **Enunciado** — com um botão pra esconder a descrição quando você já a conhece e quer focar no resultado.
- **Prazo** — data de abertura e deadline, com contagem regressiva pelo relógio do servidor. Dá pra exportar o prazo pro Google Calendar com um clique.
- **Tipos de arquivo aceitos** — as extensões que o exercício permite (ex.: `.c`, `.py`, `.zip`). Isso também define a linguagem em que seu código vai ser compilado/executado.
- **Arquivos de apoio** — materiais anexados pelo professor (enunciado em PDF, dados de entrada, templates), disponíveis pra download.
- **Painel de submissão** — onde você envia a solução e acompanha o resultado.

![página de exercício do aluno mostrando enunciado, prazo com contagem regressiva, tipos de arquivo aceitos e painel de submissão](/img/screenshots/aluno-pagina-exercicio.png)

## Duas formas de enviar

1. **Upload de arquivo** — você escreve o código no seu editor preferido e envia o arquivo pronto (arraste pro painel ou use "Selecionar arquivo").
2. **Editor no navegador** — você escreve direto na plataforma, no editor embutido (Monaco, o mesmo motor do VS Code). Ver [Usando o editor](./usando-o-editor.md).

Os dois caminhos são equivalentes: o sistema não diferencia um código enviado por upload de um escrito no editor.

![painel de submissão com as duas opções visíveis — upload de arquivo e aba "Escrever código"](/img/screenshots/aluno-painel-submissao.png)

## Regras de envio

- **Prazo**: você só consegue submeter entre a abertura e o deadline do exercício. Fora da janela, o envio é recusado ("exercício fechado").
- **Extensão**: o arquivo precisa ter uma das extensões aceitas pelo exercício. Um `.exe`, por exemplo, nunca é aceito.
- **Tamanho**: até **1 MB** pra exercícios de código (compiláveis). Exercícios de entrega de arquivo pra correção manual (ex.: um PDF de relatório) aceitam até **5 MB**.
- **Quantas vezes quiser**: cada envio é uma nova submissão ("commit"). Vale a **nota da submissão mais recente** — então cuidado pra não enviar, depois do prazo apertado, uma versão pior que a anterior. Todo o histórico fica guardado e você pode rever o código de qualquer envio antigo.

## O que acontece depois do envio

Sua submissão entra numa **fila de correção**. Um worker pega o código, compila, executa contra cada caso de teste num ambiente isolado (com limites de tempo e memória) e grava o resultado. A página atualiza sozinha enquanto isso acontece — tipicamente leva de poucos segundos a um minuto, dependendo da fila e do número de casos.

O resultado aparece como cartões de status: compilou?, quantos casos passaram, qual a nota. Pra entender cada estado, siga pra [Entendendo o resultado](./entendendo-resultados.md).

![cartão de submissão em processamento ("na fila/compilando") atualizando sozinho até exibir o resultado final](/img/screenshots/aluno-submissao-processando.png)

## Exercícios de correção manual

Alguns exercícios não têm correção automática (ex.: entrega de relatório). Nesses, o envio fica com status **"Enviado — aguardando correção"** até o professor atribuir a nota manualmente. Não há casos de teste nem recompilação.
