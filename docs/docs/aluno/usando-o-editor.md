---
title: Usando o editor de código
sidebar_position: 3
---

# Usando o editor de código

Na página do exercício, a aba **"Escrever código"** abre um editor embutido no navegador — o Monaco, o mesmo motor de edição do VS Code: realce de sintaxe pra todas as linguagens da plataforma (C, C++, Python, Java etc.), autocomplete básico, múltiplos cursores, atalhos de teclado familiares e tema claro/escuro acompanhando o tema da plataforma.

![aba "Escrever código" aberta com o editor Monaco exibindo um código C com realce de sintaxe](/img/screenshots/aluno-editor-monaco.png)

## Arquivo único

O caso mais comum: exercícios de um arquivo só.

1. Abra a aba "Escrever código". Se você já submeteu antes, o editor **pré-carrega sua última submissão** — você continua de onde parou, sem reescrever do zero.
2. Edite à vontade. O editor salva um **rascunho local automaticamente** (no seu navegador): se a página recarregar ou você fechar a aba sem submeter, o rascunho é restaurado na próxima visita. O rascunho tem prioridade sobre a última submissão — nada que você escreveu se perde.
3. Clique em **Submeter**. O conteúdo do editor é enviado como se fosse um upload de arquivo — mesma validação de extensão, tamanho e prazo.

:::info O rascunho fica só no seu navegador
O rascunho automático não é enviado ao servidor — ele vive no navegador em que você escreveu. Se for trocar de computador, submeta antes (a submissão sim fica guardada e é pré-carregada em qualquer lugar).
:::

## Projeto com vários arquivos

Pra exercícios maiores (ex.: um projeto C com `main.c`, `lista.c`, `lista.h`), o editor suporta **múltiplos arquivos**:

- Adicione, renomeie e remova arquivos na árvore lateral do editor.
- Ao submeter, a plataforma **empacota tudo num `.zip` com um `Makefile`** e envia como uma única submissão. No servidor, o projeto é compilado com `make all` e executado com `make run` — é o `Makefile` que diz como compilar e rodar o conjunto.
- Se você preferir montar o projeto fora da plataforma, pode enviar você mesmo um `.zip` contendo seus fontes e um `Makefile` com os alvos `all` (compila) e `run` (executa) — desde que o exercício aceite `.zip`.

![editor em modo projeto multi-arquivo, com a árvore de arquivos (main.c, lista.c, lista.h, Makefile) ao lado do código](/img/screenshots/aluno-editor-multiarquivo.png)

:::tip O Makefile é parte da solução
Num projeto multi-arquivo, erro no `Makefile` é erro de compilação como outro qualquer: se `make all` falha, a submissão falha. Teste o `make` localmente antes de enviar, se puder.
:::

## O que o editor não faz

- **Não executa código no navegador** — rodar e corrigir é sempre trabalho do servidor, via submissão. O editor é só edição.
- **Não tem terminal nem depurador** — pra depurar passo a passo, use o seu ambiente local e traga o código pronto (por upload ou colando no editor).

## Editor em celular/tablet

Em telas pequenas, a experiência prioriza **consultar**: ler enunciado, acompanhar resultado, ver notas. Escrever código novo em touchscreen é desconfortável por natureza — a plataforma recomenda abrir no desktop pra isso, mas enviar um arquivo já pronto continua funcionando normalmente no celular.
