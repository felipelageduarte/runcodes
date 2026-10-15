---
title: Entendendo o resultado
sidebar_position: 4
---

# Entendendo o resultado

Depois de submeter, cada envio ("commit") passa por: **fila → compilação → execução dos casos de teste → nota**. A página acompanha o progresso sozinha.

## Os status de uma submissão

| Status | O que significa | O que fazer |
|---|---|---|
| **Na fila** | Aguardando um worker de correção pegar sua submissão. | Esperar — normalmente segundos. |
| **Compilando** | Seu código está sendo compilado. | Esperar. |
| **Compilado** | Compilou; os casos de teste estão rodando. | Esperar. |
| **Completo** ✅ | Todos os casos de teste passaram. Nota 10. | Comemorar. |
| **Incompleto** | Rodou, mas nem todos os casos passaram. A nota é proporcional aos acertos. | Ver o resultado por caso e corrigir. |
| **Erro** ❌ | A compilação falhou, ou o programa quebrou na execução. | Ler a mensagem do compilador / o sinal de erro — ver [Erros e sinais](./erros-e-sinais.md). |
| **Enviado** | Exercício de correção manual — aguardando o professor dar a nota. | Esperar a correção. |
| **Plágio** | A submissão foi marcada como plágio pelo professor. | Falar com o professor da disciplina. |
| **Erro do servidor** | Falha interna da plataforma (não é culpa do seu código). | Reenviar; se persistir, abrir um chamado de suporte. |

![cartão de resultado de submissão com status "Incompleto", nota parcial e contagem de casos corretos](/img/screenshots/aluno-resultado-incompleto.png)

## Resultado por caso de teste

Expandindo uma submissão, você vê o resultado **caso a caso**:

- **Correto** — a saída do seu programa bateu com a esperada.
- **Incorreto** — rodou, mas a saída é diferente da esperada.
- **Malformado** — a saída não pôde nem ser comparada (ex.: programa abortou no meio, saída truncada).

Pra cada caso, dependendo do que o professor liberou, você pode ver a **entrada**, a **saída esperada** e a **sua saída** — e compará-las. Alguns professores deixam parte dos casos ocultos de propósito (pra evitar soluções "decoradas" pro gabarito); nesses, você vê só o veredito.

![painel expandido de uma submissão listando os casos de teste, com um caso incorreto aberto mostrando entrada, saída esperada e saída do aluno lado a lado](/img/screenshots/aluno-casos-de-teste.png)

:::tip A comparação é exata
Na comparação de texto, **cada caractere conta**: um espaço a mais no fim da linha, uma quebra de linha faltando ou um "Resposta:" que o enunciado não pediu tornam o caso incorreto. Imprima exatamente o que o enunciado especifica — nada além. Exercícios de resposta numérica podem usar comparação com tolerância (o professor define a margem de erro), mas o padrão é comparação exata.
:::

## Nota

A nota de cada submissão é `10 × casos corretos ÷ total de casos`. **Vale a submissão mais recente** — não a melhor. Suas notas por exercício aparecem na página da turma; o professor vê a matriz completa da turma.

## Histórico

Todas as suas submissões ficam no histórico do exercício, com data, status e nota. Em qualquer uma, o botão **"Ver código enviado"** abre exatamente o arquivo que você mandou naquela ocasião — útil pra comparar o que mudou entre uma tentativa e outra.

![histórico de submissões de um exercício com várias tentativas e o botão "Ver código enviado" em uma delas](/img/screenshots/aluno-historico-submissoes.png)

## Por que a minha nota mudou sem eu reenviar?

Duas possibilidades legítimas:

1. O professor **corrigiu manualmente** sua nota (ex.: um caso excepcional que o corretor automático não cobre).
2. O professor **alterou os casos de teste e recompilou** as submissões da turma — sua última submissão foi reavaliada com a régua nova.

Nos dois casos, a nota exibida é a oficial. Em dúvida, pergunte ao professor.
