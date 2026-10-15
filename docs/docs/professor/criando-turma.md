---
title: Criando e gerenciando uma turma
sidebar_position: 1
---

# Criando e gerenciando uma turma

No run.codes, a hierarquia é: **disciplina** (ex.: "SCC0219 — Introdução à Programação") → **turma** (uma oferta da disciplina num semestre, ex.: "2026/2 — Turma A") → **exercícios** dentro da turma.

## Papéis dentro de uma turma

| Papel | O que pode |
|---|---|
| **Aluno** | Submeter, ver os próprios resultados e notas. |
| **Assistente/monitor** | Tudo de gestão da turma: exercícios, casos de teste, notas, promover membros. |
| **Professor** | O mesmo que o assistente (o papel distingue a função, não o nível de acesso dentro da turma). |

O papel vale **por turma**: um aluno de uma turma pode ser monitor de outra.

## Criando a turma

1. No painel, clique em **Nova turma**.
2. **Escolha a disciplina** da sua universidade na busca. Se a disciplina ainda não existe no catálogo, peça a um administrador da plataforma pra cadastrá-la (criação de disciplina é ação administrativa — a tela indica a quem recorrer).
3. Preencha período/identificação da turma, sala e data de término.
4. Ao salvar: você é matriculado automaticamente como **professor** da turma, o sistema gera um **código de matrícula único** e envia o código pro seu email.

![formulário "Nova turma" com busca de disciplina, campos de identificação e o aviso sobre pedir cadastro de disciplina a um admin](/img/screenshots/prof-nova-turma.png)

## Convidando os alunos

Divulgue o **código de matrícula** (está na página da turma) — cada aluno entra sozinho com ele, em segundos. Alternativas na aba de participantes:

- **Matricular manualmente** um usuário pelo email (útil pra monitores, ou aluno com dificuldade de acesso).
- **Promover/rebaixar** um membro já matriculado (aluno ↔ assistente ↔ professor).
- **Desmatricular** um membro (remoção definitiva da turma).
- **Banir** um membro (bloqueia rematrícula) — essa ação específica é restrita a administradores da plataforma; se precisar, abra um chamado.

![aba de participantes da turma com a lista de matriculados e o menu de ações de linha (promover, desmatricular)](/img/screenshots/prof-participantes.png)

:::warning O código só funciona pra mesma universidade
Alunos com conta cadastrada em outra universidade não conseguem usar o código. Se um aluno reportar o erro "universidade diferente", é a conta dele que está cadastrada na instituição errada.
:::

## Comunicação com a turma

- **Email pra turma inteira**: na página da turma, você escreve uma mensagem que é enviada por email a todos os matriculados ativos. O assunto sai prefixado com o código da disciplina.
- **Avisos da plataforma** (staff): avisos publicados aparecem como banner pra todos os usuários logados — use pra comunicados que importam além da sua turma (manutenção, prazos institucionais).

## Editando a turma

Depois de criada, você pode editar **sala** e **data de término**. Disciplina e código de matrícula não mudam — se a turma foi criada na disciplina errada, crie outra e desative a antiga.

Próximo passo: [criar o primeiro exercício](./criando-exercicios.md).
