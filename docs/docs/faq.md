---
title: Perguntas frequentes (FAQ)
sidebar_position: 9
---

# Perguntas frequentes

## Conta e acesso

**Não recebi o email de confirmação.**
Confira a caixa de spam. Se não estiver lá, use "Reenviar confirmação" na tela de login — o link anterior expira em 24 horas, o reenvio gera um novo.

**Esqueci minha senha.**
"Esqueci minha senha" na tela de login. O link de redefinição chega por email e vale por 1 hora; você escolhe a senha nova na plataforma.

**O código da turma dá "universidade diferente".**
Sua conta foi cadastrada numa universidade diferente da turma. Corrija a universidade no seu perfil (ou fale com o professor se a turma é que está na instituição errada).

## Submissões (aluno)

**Minha submissão está presa em "na fila" há muito tempo.**
Alguns segundos a um minuto é normal (há uma fila compartilhada). Travou por vários minutos? Costuma ser indisponibilidade temporária do corretor — tente reenviar mais tarde; persistindo, abra um chamado de suporte.

**"Funciona no meu computador" mas falha na plataforma.**
As causas clássicas estão em [Erros e sinais](./aluno/erros-e-sinais.md#funciona-aqui-falha-lá): comportamento indefinido (C/C++), prompts impressos na saída ("Digite um número:"), casos de teste maiores que os exemplos, versão de compilador diferente.

**Passei em todos os casos visíveis mas a nota não é 10.**
O exercício tem casos ocultos — você está falhando num deles. Revise casos de borda: entrada vazia, valores extremos, entradas grandes (desempenho).

**Posso submeter quantas vezes quiser?**
Sim, dentro do prazo. Vale a nota da **submissão mais recente** — não a melhor. Não reenvie uma versão pior depois de uma boa.

**Minha nota mudou sem eu reenviar.**
Ou o professor corrigiu sua nota manualmente, ou recompilou a turma com casos de teste atualizados. Ver [Entendendo o resultado](./aluno/entendendo-resultados.md#por-que-a-minha-nota-mudou-sem-eu-reenviar).

**Perdi o que estava escrevendo no editor?**
Provavelmente não: o editor salva rascunho automático no navegador. Reabra a aba "Escrever código" do mesmo exercício, no mesmo navegador. O rascunho é local — em outro computador ele não existe (mas sua última submissão sim, e é pré-carregada).

**O que é SIGSEGV / SIGKILL / SIGFPE?**
O sinal com que seu programa morreu. Tabela completa com as causas típicas em [Erros e sinais](./aluno/erros-e-sinais.md#o-programa-quebrou-sinais). Resumo: SIGSEGV = acesso inválido de memória; SIGKILL = estourou tempo ou memória; SIGFPE = divisão por zero.

**Como submeto um projeto com vários arquivos?**
Pelo editor em modo projeto (empacota como `.zip` com `Makefile` automaticamente) ou enviando você mesmo um `.zip` com os fontes e um `Makefile` com alvos `all` e `run` — desde que o exercício aceite `.zip`. Ver [Usando o editor](./aluno/usando-o-editor.md#projeto-com-vários-arquivos).

## Turmas e exercícios (professor)

**Minha disciplina não aparece na busca ao criar turma.**
O catálogo de disciplinas é mantido pelos administradores da plataforma. Peça o cadastro da disciplina a um admin da sua instituição; depois crie a turma normalmente.

**Mudei um caso de teste e as notas ficaram inconsistentes.**
Esperado: as submissões antigas foram avaliadas com a régua antiga (a plataforma marca isso como "submissões desatualizadas"). Use **recompilar o exercício** pra reavaliar a submissão mais recente de cada aluno pelos casos atuais — [detalhes](./professor/acompanhando-notas.md#recompilação).

**Um aluno ficou sem nota por um problema alheio a ele. Como resolvo?**
Edite a nota/status da submissão manualmente ([correção manual](./professor/acompanhando-notas.md#correção-manual-de-nota)), ou recompile só a submissão dele.

**Posso impedir que os alunos vejam os casos de teste?**
Sim — visibilidade de entrada, saída esperada e saída do aluno é por caso, com três chaves independentes. Estratégia recomendada em [Casos de teste](./professor/casos-de-teste.md#estratégia-de-visibilidade).

**Quem pode banir um aluno da turma?**
Banir (bloquear rematrícula) é ação de administrador da plataforma. Professor/assistente pode **desmatricular** (remover da turma). Ver [gestão da turma](./professor/criando-turma.md#convidando-os-alunos).

**O detector de plágio acusou um par com 0.9. Isso prova cópia?**
Não — é um sinal pra revisão humana. Leia [como interpretar o resultado](./professor/deteccao-de-plagio.md#lendo-o-resultado) antes de qualquer decisão.

## Suporte

**Como falo com o suporte?**
Abra um **chamado** (ticket) pelo menu da plataforma, descrevendo o problema — inclua turma, exercício e horário aproximado quando for sobre uma submissão. Você acompanha a resposta em "Meus chamados".
