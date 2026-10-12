---
title: Marketplace de exercícios entre professores
sidebar_position: 5
---

# Marketplace de exercícios

## O que já existe no backend

O mecanismo de **reuso** já está implementado e testado — não é uma feature nova do zero:

- `public_exercises` (tabela) + `PublicExerciseService` — um exercício pode ser marcado como reutilizável (`POST /api/public-exercises/:exerciseId`), com `level` (dificuldade declarada manualmente), `obs` (observação livre) e `keywords` (string de busca).
- **Exercícios "ghost"** — `ExerciseManagementService.shareToOffering()` clona um exercício pra outra turma: cria uma linha `ghost=true, real_id=<original>` que redireciona casos de teste, arquivos e allowed-files pro exercício real. É o mecanismo de "adoção" — já existe, já funciona, já tem teste de integração.

O que falta é a **camada de descoberta**: hoje `shareToOffering()` exige que o professor já saiba o `exerciseId` de cor. Não existe busca, filtro, ordenação, nem visualização de "o que esse exercício realmente é" antes de adotar. É isso que este documento especifica.

## Jornada do usuário

1. Professor vai criar/editar uma turma e precisa de exercícios. Em vez de criar do zero, abre o **Marketplace**.
2. Busca por palavra-chave (título, `keywords`), filtra por **linguagem** (Python, C, Java...) e **instituição de origem** (USP, UFMG...), ordena por **nome**, **mais recente**, **dificuldade** ou **popularidade**.
3. Abre o card de um exercício → vê enunciado completo (preview, sem poder editar), estatísticas agregadas (quantas turmas já adotaram, nota média histórica, taxa de acerto), linguagens aceitas, instituição/autor de origem.
4. Clica "Adotar nesta turma" → escolhe a turma de destino (se tiver mais de uma sob gestão) → chama o `shareToOffering()` já existente. O exercício aparece na turma como ghost, exatamente como já funciona hoje pro compartilhamento direto.
5. Depois de adotar, o exercício é editável normalmente *na cópia ghost* dentro dos limites que ghost já permite hoje (a edição de casos de teste e arquivos sempre afeta o exercício real, não a cópia — comportamento já existente, documentado em [exercise-management.md](../backend/exercise-management.md)).

## Gaps de backend a implementar (não existem hoje)

### 1. Endpoint de busca/listagem com filtro e ordenação

`GET /api/public-exercises` hoje só pagina, sem filtro nem ordenação customizável. Especificação do novo comportamento (pode estender o endpoint existente ou criar `GET /api/marketplace/exercises` dedicado — decisão de implementação, não de contrato):

```
GET /api/marketplace/exercises
  ?search=<texto>              # busca em title + keywords (ILIKE ou full-text search Postgres)
  &language=<extensão>         # filtra por allowed_files_exercises.allowed_file.extension do exercício real
  &universityId=<id>           # filtra por courses.university_id via offerings do exercício real
  &sortBy=name|recent|difficulty|popularity   # default: recent
  &sortDir=asc|desc
  &page=&pageSize=
```

Resposta: lista de `PublicExerciseSummary` (ver schema abaixo) + `total` pra paginação.

### 2. Campo de data de publicação

`public_exercises` não tem timestamp hoje. **Nova coluna**: `public_exercises.created_at TIMESTAMP DEFAULT now()`. Sem isso, "ordenar por mais recente" não tem o que ordenar — a tabela `exercises` também não tem `created_at` (só `deadline`/`open_date`, que são datas de uso, não de criação).

### 3. Métrica de dificuldade calculada

`level` (hoje) é uma dificuldade *declarada* pelo professor, subjetiva. O pedido é uma dificuldade **calculada**: taxa de tentativas até acerto, nota média. Isso exige agregação sobre `commits` de **todas as cópias** do exercício (o original + todo `ghost` cujo `real_id` aponta pra ele), porque cada turma que adota gera commits próprios contra o id da sua cópia ghost, não contra o original.

Especificação da métrica (`MarketplaceStatsService`, novo serviço no `runcodes-api`):

```ts
interface ExerciseMarketplaceStats {
  exerciseId: number;
  adoptionCount: number;        // COUNT(ghost exercises WHERE real_id = exerciseId)
  totalSubmitters: number;      // alunos distintos com >=1 commit em qualquer cópia
  avgAttemptsToSuccess: number; // média de commits até o 1º commit com corrects = total de casos, por aluno
  avgScore: number;             // média de score do último commit de cada aluno, por cópia, agregado
  passRate: number;             // % de alunos cujo último commit teve status "aprovado"
}
```

Cálculo via `CommitRepository` (reaproveitando `listLatestPerStudentForExercise`, já existe) rodado contra o exercício real **e** cada ghost (`WHERE real_id = exerciseId OR id = exerciseId`) — agregado no service, não no banco via view materializada por enquanto (volume baixo o suficiente pra não justificar a complexidade de manter uma view atualizada; revisitar se o catálogo crescer a ponto de a agregação on-demand pesar).

Dificuldade exibida na UI é um bucket (`Fácil`/`Médio`/`Difícil`) derivado de `avgAttemptsToSuccess` + `passRate` combinados, não os números brutos — números brutos ficam disponíveis no detalhe do exercício pra quem quiser ver.

### 4. Linguagem do exercício como filtro

Hoje a linguagem é derivada indiretamente via `allowed_files_exercises` → `allowed_files.extension`. Pra marketplace, basta que o endpoint de listagem faça esse join e devolva `languages: string[]` por exercício (extensões aceitas) — não precisa de coluna nova, é leitura derivada.

### 5. Instituição de origem

Derivada via `exercise → offering → course → university` (join já possível com os repositórios existentes: `OfferingRepository`, `CourseRepository`, `UniversityRepository`). Expor `originUniversity: { id, name, abbreviation }` no `PublicExerciseSummary`.

### 6. Schema de resposta (`PublicExerciseSummary`)

```ts
interface PublicExerciseSummary {
  exerciseId: number;
  title: string;
  description: string | null;      // enunciado, truncado no card, completo no detalhe
  level: number | null;             // dificuldade declarada
  keywords: string | null;
  createdAt: string;                // ISO — novo campo (ver gap #2)
  languages: string[];              // extensões aceitas (ver gap #4)
  originUniversity: { id: number; name: string; abbreviation: string } | null;
  stats: ExerciseMarketplaceStats;  // ver gap #3
}
```

### 7. Endpoint de adoção dedicado (opcional, UX)

`shareToOffering()` já serve como mecanismo de adoção. Opcionalmente, um alias semântico `POST /api/marketplace/exercises/:exerciseId/adopt { targetOfferingId }` que apenas chama o mesmo service por trás — mais claro na telemetria/log de auditoria ("adotou do marketplace" vs. "compartilhou manualmente") do que reusar o endpoint genérico de share. Decisão de nomenclatura, não de lógica nova.

## Visibilidade cross-instituição é a feature, não um bug

Hoje nada impede (nem deveria impedir) um professor da UFMG descobrir e adotar um exercício publicado por um professor da USP — isso é o valor central do marketplace. O filtro de instituição na UI é uma ferramenta de **busca**, não uma barreira de **acesso**: por padrão a listagem é global, o filtro só restringe o que é mostrado na tela de quem está procurando.

## Fronteira de responsabilidade no frontend (módulo `marketplace`)

- `modules/marketplace/` — tela de listagem (filtros, ordenação, busca), card de exercício, modal/página de detalhe com preview do enunciado, fluxo de adoção (seleção de turma destino).
- Reusa `modules/professor/` pra tudo que acontece *depois* de adotar (editar o exercício ghost, gerenciar casos de teste) — marketplace não duplica a tela de edição de exercício, só a descoberta e o ponto de entrada.
- O preview do enunciado reusa o mesmo renderer de markdown sanitizado especificado em [security.md](./security.md#xss-via-conteúdo-gerado-por-usuário) — é conteúdo de outro professor, tratado como não-confiável do mesmo jeito que o enunciado da própria turma.
