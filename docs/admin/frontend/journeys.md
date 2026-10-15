---
title: Jornadas de usuário
sidebar_position: 3
---

# Jornadas de usuário

Mapeadas a partir do comportamento real do `server` legado (controllers e views CakePHP) — **não como inspiração de UI**, só para garantir que nenhuma lógica de negócio ou caso de borda que hoje funciona em produção se perca na reconstrução. A interface é desenhada do zero conforme [design-system.md](./design-system.md); este documento descreve o que cada papel precisa *fazer*, não como a tela legada faz.

## Padrão transversal: mesma URL, render por papel

O legado já acerta uma coisa estruturalmente: `GET /exercises/view/:id` redireciona internamente para `viewProfessor` quando quem acessa é staff da turma (`ExercisesController::view()` → `Enrollment::isEnrolledAsProfessorOrAssistant()`) — a mesma URL leva a experiências completamente diferentes por papel, sem expor isso na rota. **Esse é exatamente o princípio de "hiperpersonalização por papel" já adotado em [overview.md](./overview.md#personalização-por-papel-o-que-hiperpersonalizado-significa-aqui)** — a rota é a mesma (`/exercises/:id`), o módulo que renderiza (`student` ou `professor`) é resolvido client-side por `useSession().role` + matrícula na turma, sem redirect visível nem duplicar a URL.

## Jornada de entrada

```
Cadastro (email+senha) → confirmação por email → login → [complementar perfil] → dashboard
```

- **Signup** (`UsersController::add()`) — cria usuário `type=0` (aluno; promoção é sempre ação de staff/admin, nunca do próprio cadastro — regra que o `runcodes-api` já replica), dispara email de confirmação. Já coberto 1:1 pelo backend novo ([users.md](../backend/users.md)).
- **Confirmação / reenvio / reset de senha** — mesmo fluxo, já migrado com token aleatório expirável em vez do link determinístico sem expiração do legado (`sha1(salt+email)`, ver [users.md](../backend/users.md)). **Diferença real a preservar**: o legado bloqueia recuperação de senha pra conta não confirmada E pra conta criada via LinkedIn (`source=1`) — mensagens diferentes pra cada caso (`"Esta conta está vinculada ao LinkedIn"` vs. `"Sua conta não está confirmada"`). O backend novo não tem esse segundo caso porque **login social não existe ainda** no `runcodes-api` — ver gap abaixo.
- **Login social (Google, LinkedIn)** — existe no legado (`UsersController::googleCallback()`, `linkedin()`/`linkedinCallback()`), **não existe no `runcodes-api`**. Não é um gap de frontend — é uma decisão de produto (vale manter dois provedores OAuth?) que precisa ser respondida antes de aparecer em qualquer fase deste roadmap. Documentado, não planejado.
- **Completar cadastro com identificador da universidade** — o legado bloqueia o dashboard (`home_student()`) com um redirect de página inteira pro perfil se `identifier` não for numérico, com flash message. Na reconstrução isso é um **banner inline dismissível no dashboard** + campo obrigatório no formulário de perfil — nunca um redirect forçado que impede ver qualquer outra coisa do produto.

## Dashboard — fila de trabalho, não lista de turmas

`PagesController::home_student()` já tem a ideia certa, só a execução datada: busca as turmas ativas do usuário, pega todos os exercícios abertos (ou "mostrar antes de abrir") das turmas em que está matriculado, calcula o status de cada um (não entregue / corrigindo / aprovado / reprovado, com cor semântica), ordena por **urgência** — exercícios ainda não aprovados primeiro (por prazo mais próximo), aprovados por último — e corta nos 5 primeiros.

**Preservar**: a lógica de ordenação por urgência (não por data de criação, não por turma) é o coração do dashboard e deve continuar sendo a primeira coisa que o aluno vê.
**Não preservar**: cortar em 5 e escondido o resto — a nova versão mostra a fila completa com scroll/paginação, e adiciona o que falta hoje: indicação de prazo relativo ("vence em 6h", não só a data absoluta) e nenhuma notificação proativa (ver riscos, seção de segurança/roadmap).

Para professor/assistente, o dashboard equivalente são as turmas sob gestão (`$logged_user['type'] >= 2` no menu legado) — hoje é um dropdown de menu, não um dashboard de verdade. Na reconstrução, o dashboard do professor mostra isso como cards de turma com indicadores (submissões pendentes de revisão, prazo mais próximo da turma, alertas de plágio em aberto) — informação que hoje só aparece depois de entrar em cada turma individualmente.

## Jornada do aluno

```
Turma → lista de exercícios (status por item) → exercício → editar/enviar → feedback por caso → notas/histórico
```

- **Entrar em turma por código** — inalterado, já migrado (`EnrollmentsController::add()` → `POST /api/enrollments`).
- **Página da turma** (`OfferingsController::view()`) hoje é uma única página longa: dados da turma, modal de gestão de participantes (só visível pra staff — o aluno nunca vê essa seção), lista paginada de exercícios em abas, painel de estatísticas (só staff). Pra aluno, a reconstrução é **uma tela**: lista de exercícios com status, sem nada do que não lhe pertence (nem escondido por CSS — nem carregado).
- **Exercício** (`ExercisesController::view()`) — enunciado (com toggle mostrar/esconder descrição — detalhe pequeno mas real: o aluno que já sabe o enunciado de cor quer esconder pra focar no resultado), arquivos anexos pra download, tipos de arquivo aceitos, acordo de uso específico por linguagem (ex. aviso de licença Java, aviso de convenção de Makefile — elementos `javaAgreement`/`makeAgreement` no legado, texto fixo por linguagem que precisa ser preservado como conteúdo, não como lógica). Painel de submissão ao lado (desktop) com contagem de prazo. Depois de qualquer commit existir: cards de status (compilou?, casos corretos, nota) com **polling automático enquanto o status for "em processamento"** — hoje via Angular `startRefreshing()`, no novo é `TanStack Query` com `refetchInterval` condicional (para de poll quando sai de `IN_QUEUE`).
- **Exportar prazo pro Google Calendar** (`ExercisesController::exportExerciseToGoogleCalendar()`) — feature pequena, de baixo custo, presente em cada exercício hoje. Vale manter (é um botão, não um fluxo).
- **Histórico de commits e detalhe por caso** — hoje são páginas separadas com reload (`Commits::details()`, seletor dropdown pra trocar de caso visível). Na reconstrução isso é um painel expansível na própria tela do exercício, sem navegação.
- **Notas** — a matriz de notas da turma (`OfferingsController::grades()`) já existe tipada no backend; pro aluno, a visão é só a própria linha, não a matriz completa (que é ferramenta de staff).

## Jornada do professor/assistente

```
Criar turma → criar exercício (do zero ou do marketplace) → casos de teste → acompanhar submissões → plágio → notas/export/stats
```

- **Turma**: criar (`OfferingsController::add()`), editar, gerenciar participantes — hoje um modal sobre a mesma página (`ng-controller="OfferingController"`, tabela carregada via Ajax dentro do modal). Promover/banir é ação de linha dentro dessa tabela. Preservar a granularidade (promover pra assistente ≠ promover pra professor ≠ banir), já modelada 1:1 no `runcodes-api` ([enrollments.md](../backend/enrollments.md)).
- **Exercício**: hoje criar exercício e criar caso de teste são duas telas com reload entre elas (`Exercises::add()` → depois de salvar, vai pra tela separada de casos). A reconstrução unifica num wizard de uma tela (metadados → casos de teste → arquivos permitidos/anexos → revisão) — sem perder a opção de criar casos depois, pra quem só quer publicar o enunciado primeiro.
- **Visão do exercício pro staff** (`ExercisesController::viewProfessor()`) já é mais densa que a do aluno: descrição + gestão de casos (toggle mostrar input/output/casos, ligados a `showInput()`/`showExpectedOutput()`/`showUserOutput()` — ações de um clique no legado que viram apenas um switch no novo) + painel de informação (download do zip de todas as últimas submissões, allowed files, compartilhar/ghost) + também pode submeter (staff testando o próprio exercício) + gráfico de % de acerto por caso. Tudo isso continua sendo uma tela, só reorganizada visualmente — nenhum desses recursos é dispensável, são as ferramentas de dia-a-dia de quem corrige uma disciplina.
- **Importar exercício do marketplace** (`ExercisesController::import()`) — hoje é uma tela de formulário que recria o exercício inteiro (prazo, janela de abertura, tipos de arquivo aceitos) a partir de uma cópia pública. É literalmente o fluxo que [marketplace.md](./marketplace.md) está especificando com descoberta de verdade por cima.
- **Plágio** — disparo e resultado já modelados no backend ([plagiarism-detection.md](../roadmap/plagiarism-detection.md)); a tela nova precisa decidir como apresentar pares suspeitos (Dolos + JPlag) de forma legível, não como o legado faz (relatório cru).
- **Stats/export** — infográfico + gráfico de média da turma (`OfferingStatsController`, duas chamadas separadas no legado) + export CSV + zip de submissões, todos já expostos pelo backend ([admin-and-support.md](../backend/admin-and-support.md)). Reconstrução: um painel só, uma chamada por dado (ou agregado no backend se fizer sentido depois), sem o delay perceptível de duas requisições sequenciais que o legado tem hoje.

## Jornada do admin

Painel separado, estético propositalmente utilitário (densidade alta, sem floreio) — gestão de universidades, tipos de arquivo permitido, usuários, log de auditoria. A diferença real pro novo painel: **o log de auditoria agora tem conteúdo de verdade** (toda mutação do sistema é registrada via middleware — ver [backend: log de auditoria](../backend/admin-and-support.md#log-de-auditoria-escrita)), onde antes a tela existia mas a tabela ficava vazia.

### "View as" (impersonação) — existe no legado, não existe no `runcodes-api`

`Users::viewAs($type)` deixa um professor "virar" aluno ou assistente (e um admin virar qualquer papel abaixo do seu) sem trocar de conta — essencial pra quem ensina testar a própria turma do ponto de vista de quem vai usá-la. **Gap real a especificar**: não existe endpoint equivalente no backend novo hoje. Precisa de:
- Um endpoint que emite um token "escopado" (mesmo usuário, papel efetivo rebaixado) — nunca eleva privilégio, só abaixa.
- Registro em log de auditoria de toda troca (hoje o legado não grava isso em lugar nenhum — achado deste mapeamento, não comportamento a replicar).
- Indicador visual permanente na UI enquanto ativo ("Você está vendo como Aluno — Sair do modo de visualização"), pra nunca ser ambíguo qual é o papel real de quem está logado.

## Padrões de UI recorrentes a não repetir

- **Reload de página inteira pra qualquer mutação simples** (promover, banir, marcar caso como visível) — vira ação otimista com toast, sem navegação.
- **Flash message de sessão** (sobrevive um redirect, não um estado de React) — vira toast local, sem precisar de round-trip de servidor pra aparecer.
- **Duas requisições sequenciais obrigatórias pra montar uma tela** (infográfico depois stats, exercício depois casos) — paraleliza ou agrega no backend quando o custo de duas chamadas for perceptível.
- **Formulário sem validação client-side, erro só depois de enviar** — todo formulário novo valida com o mesmo schema Zod que o backend usa, antes de gastar uma request.
