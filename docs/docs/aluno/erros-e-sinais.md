---
title: Erros de compilação e sinais
sidebar_position: 5
---

# Erros de compilação e sinais (SIGSEGV e companhia)

Quando sua submissão termina em **Erro**, a causa está em uma de duas fases: a **compilação** falhou, ou o programa compilou mas **quebrou durante a execução** de algum caso de teste.

## Erros de compilação

Se o compilador rejeitou seu código, o cartão da submissão mostra a **saída bruta do compilador** — a mesma mensagem que você veria rodando `gcc`/`javac`/etc. localmente.

![cartão de submissão com erro de compilação exibindo a mensagem do compilador (ex.: gcc apontando linha e erro)](/img/screenshots/aluno-erro-compilacao.png)

Checklist antes de reenviar:

- **Compila na sua máquina?** Compile localmente com flags estritas antes de enviar. Lembre que a versão do compilador do servidor pode ser diferente da sua.
- **A extensão está certa?** Um código C enviado como `.cpp` compila com outro compilador — e pode falhar.
- **Projeto multi-arquivo:** se `make all` falha, a mensagem aqui é a saída do `make`. Confira o `Makefile` (ver [Usando o editor](./usando-o-editor.md#projeto-com-vários-arquivos)).
- **Cuidado com dependências**: só a biblioteca padrão da linguagem está garantida no ambiente de correção. `#include` ou `import` de biblioteca externa que o exercício não fornece falha na compilação ou na execução.

## O programa quebrou: sinais

Quando o programa compila mas morre durante um caso de teste, o sistema informa o **sinal** com que o processo terminou. A plataforma traduz os mais comuns pra uma frase em português, mas vale entender o que cada um indica:

| Sinal | Nome técnico | Causa típica | Por onde investigar |
|---|---|---|---|
| **SIGSEGV** | Segmentation fault | Acesso a memória inválida: ponteiro nulo/não inicializado, índice fora do vetor, estouro de pilha por recursão infinita. | Revise ponteiros e limites de vetor. Em C/C++, rode localmente com `valgrind` ou compile com `-fsanitize=address`. |
| **SIGABRT** | Abort | O próprio programa abortou: `assert` falhou, exceção não tratada, corrupção de heap detectada (`free` duplo, buffer overflow em `malloc`). | Veja qual `assert`/exceção disparou; em C, revise os `malloc`/`free`. |
| **SIGFPE** | Floating point exception | Apesar do nome, quase sempre **divisão inteira por zero** (ou módulo por zero). | Procure divisões e `%` onde o divisor pode ser 0 pra alguma entrada. |
| **SIGKILL** | Killed | O programa estourou um **limite de recurso** — quase sempre **tempo** (loop infinito ou algoritmo lento demais pro tamanho da entrada), às vezes **memória**. | Procure loops cuja condição de parada pode nunca acontecer; reavalie a complexidade do algoritmo pro maior caso de teste. |
| **SIGBUS** | Bus error | Acesso de memória desalinhado/inválido — primo do SIGSEGV. | Mesma investigação do SIGSEGV. |
| **SIGXFSZ** | File size limit | O programa escreveu mais do que o limite de arquivo permite (ex.: imprimiu em loop infinito). | Procure `printf`/`print` dentro de loop sem parada. |

![cartão de submissão com erro de execução exibindo o sinal traduzido (ex.: "SIGSEGV — acesso inválido de memória") junto do caso de teste em que ocorreu](/img/screenshots/aluno-erro-sinal.png)

:::tip O limite de tempo é por caso de teste
Cada caso de teste roda com limite de tempo e de memória próprios, definidos pelo professor. Um programa correto mas lento pode passar nos casos pequenos e ser morto (SIGKILL) só no caso grande — se isso acontecer, o problema costuma ser a complexidade do algoritmo, não um bug.
:::

## "Funciona aqui, falha lá"

As causas mais comuns da diferença entre a sua máquina e o corretor:

1. **Comportamento indefinido** (C/C++): variável não inicializada ou acesso fora do vetor pode "funcionar" localmente por sorte e quebrar no servidor. Sanitizers (`-fsanitize=address,undefined`) pegam isso.
2. **Leitura de entrada diferente do especificado**: o corretor alimenta o programa pela **entrada padrão** (stdin), exatamente como o enunciado descreve. Não imprima prompts tipo `"Digite um número: "` — isso vai pra saída e quebra a comparação.
3. **Limites maiores**: os casos de teste do servidor costumam ser maiores que os exemplos do enunciado. Dimensione vetores e algoritmos pros limites do enunciado, não pros exemplos.
4. **Versão de compilador/linguagem**: um recurso muito novo da linguagem pode não existir na versão instalada no ambiente de correção.
