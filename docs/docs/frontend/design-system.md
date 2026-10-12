---
title: Design system e UX
sidebar_position: 2
---

# Design system e UX

## Princípios visuais

O legado (CakePHP + Bootstrap 3-era) tem UI datada: formulários sem validação client-side, navegação por reload de página inteira, tabelas densas sem estados vazios/loading, pouquíssima hierarquia visual. O objetivo aqui não é "modernizar o visual" — é reconstruir a experiência assumindo os padrões que hoje são esperados por padrão: feedback imediato, estados de carregamento, confirmação antes de ações destrutivas, responsividade real.

- **Clean, não minimalista vazio**: hierarquia visual clara (tipografia com 3-4 pesos, não 8), espaçamento generoso, cor usada com intenção (status de submissão, severidade de erro) — não decoração.
- **Densidade adaptativa**: a tela do professor (tabela de notas de 40 alunos × 10 exercícios) precisa de densidade alta; a tela do aluno (3 exercícios da semana) precisa de respiro. O design system permite as duas sem dois sistemas visuais diferentes — via tokens de espaçamento/tamanho de tabela, não via telas desenhadas do zero cada vez.
- **Acessibilidade como padrão, não feature**: Radix UI garante foco/teclado/ARIA corretos nos primitivos (modal, dropdown, tabs, tooltip); contraste AA mínimo em todos os tokens de cor; toda imagem/ícone funcional tem label.

## Tema e tokens

Paleta e espaçamento vivem como CSS custom properties (Tailwind v4 já trabalha nativamente com isso via `@theme`), não hardcoded em componente:

- **Cor primária**: azul (mantém familiaridade com a identidade visual atual do run.codes, sem herdar o Bootstrap genérico) — um tom só, com escala de 10 níveis (50-950) gerada, não 5 azuis escolhidos a dedo.
- **Semânticas de status**: `success` (caso de teste passou / submissão aceita), `danger` (falhou / erro de compilação), `warning` (prazo próximo, pendências), `info` (neutro). Essas 4 cores são usadas **consistentemente** em todo o produto — o mesmo verde que marca "caso de teste correto" marca "aluno confirmado" no admin.
- **Modo escuro desde o dia 1**: `prefers-color-scheme` + toggle manual persistido. Público é estudante/professor de CS — dark mode não é opcional nesse público, é esperado.
- **Tipografia**: uma fonte sans-serif variável (Inter ou similar) pra UI, uma monoespaçada (JetBrains Mono / mesma família do Monaco) pra qualquer trecho de código, nome de arquivo, ou identificador técnico (hash de commit, email).

## Componentes do design system (`packages/ui`)

Inventário inicial, construído conforme a necessidade de cada módulo aparece (não um sprint de "construir 40 componentes antes de ter uma tela real"):

| Componente | Baseado em | Nota |
|---|---|---|
| Button, IconButton | Radix Slot | Variantes: primary/secondary/ghost/destructive; tamanhos sm/md/lg |
| Input, Textarea, Select, Checkbox, RadioGroup, Switch | Radix primitives | Integrados com React Hook Form via um adaptador fino |
| Dialog (modal), AlertDialog (confirmação destrutiva) | Radix Dialog/AlertDialog | Toda ação destrutiva (apagar exercício, banir aluno) passa por `AlertDialog`, nunca `window.confirm` |
| Toast | Radix Toast ou Sonner | Substitui os "flash messages" de reload de página do legado — feedback imediato sem navegar |
| Table | Componente próprio sobre `<table>` semântico | Suporta ordenação por coluna, paginação, densidade variável (ver acima), linha vazia com call-to-action (não só "nenhum resultado") |
| Tabs, Accordion, DropdownMenu, Tooltip, Popover | Radix primitives | |
| Badge | Próprio | Status de commit, papel de usuário, tag de dificuldade do marketplace |
| Skeleton | Próprio | Todo estado de loading tem skeleton da forma final do conteúdo, não um spinner genérico centralizado |
| EmptyState | Próprio | "Você ainda não entrou em nenhuma turma" com call-to-action, não uma tabela vazia |
| CodeBlock | Shiki (highlight estático, leve) | Pra exibir trecho de código fora do editor (ex. mensagem de erro de compilação) — Monaco é pesado pra isso |
| Breadcrumb | Próprio | Turma → Exercício → Submissão, sempre visível em telas profundas |

Cada componente tem uma story no Storybook cobrindo todos os estados visuais (default, loading, erro, vazio, disabled) — é a superfície de revisão com quem for validar UX, sem precisar montar a tela inteira do produto pra ver o componente.

## Responsividade — mobile e tablet são requisito, não "também funciona"

Breakpoints Tailwind padrão (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px), com 3 layouts de navegação, não 1 com media query de emergência:

1. **Mobile (`< md`)**: bottom nav fixa (ícones: Turmas, Exercícios, Notificações, Perfil — espelha o padrão de app mobile que o público já conhece, não um hambúrguer escondendo tudo), telas em pilha única, tabelas densas (notas, lista de submissões) viram cards por linha.
2. **Tablet (`md`–`lg`)**: sidebar colapsável (ícone-only por padrão, expande sob demanda), tabelas mantêm formato tabular mas com menos colunas visíveis por padrão (escolha de coluna via menu).
3. **Desktop (`≥ lg`)**: sidebar expandida fixa, tabelas completas, o editor de código pode abrir em painel lado-a-lado com a descrição do exercício (layout que não faz sentido em mobile — lá o editor é full-screen com a descrição em aba separada).

O editor de código em mobile/tablet é a maior decisão de UX específica: teclado de código em touchscreen é ruim por natureza (nenhum produto resolve isso bem). A posição é **não fingir que é ótimo** — em telas `< md`, o fluxo prioriza visualizar resultado de submissões já feitas, ler o enunciado, ver notas; criar/editar uma submissão nova a partir do zero no code editor empurra pra "abra no desktop" com uma mensagem clara, não trava a funcionalidade escondendo um editor ruim. Consultar e submeter um arquivo já pronto (ex. enviado do computador) continua funcionando em mobile sem o editor.

## Conteúdo e tom

- Mensagens de erro nomeiam o problema e a ação, nunca só o código (`"O arquivo .exe não é aceito neste exercício"`, não `file_type_not_allowed`) — o código fica em `data-error-code` pra debug, não na tela.
- Confirmações destrutivas dizem a consequência real (`"Isso vai apagar 3 casos de teste e todas as submissões associadas"`), não um genérico "tem certeza?".
- Português do Brasil como idioma único por agora — i18n não é requisito hoje (o público é majoritariamente ICMC/USP); a estrutura de texto (strings centralizadas, não hardcoded em 50 lugares) deixa a porta aberta sem pagar o custo de implementar i18n sem necessidade real.
