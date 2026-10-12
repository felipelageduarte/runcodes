---
title: Editor de código (Monaco)
sidebar_position: 4
---

# Editor de código embutido

## Decisão: Monaco Editor, não `code-server`

`code-server` empacota o VS Code inteiro (extensões, terminal, debugger) rodando em container, acessado via browser — tecnicamente viável (é open source), mas é a ferramenta errada pro problema daqui:

- **Custo de infra**: 1 container por sessão ativa, análogo ao `compiler-engine` mas *interativo e de longa duração* (não um job que termina) — multiplica o custo de hospedagem por usuário conectado simultaneamente, não por submissão.
- **Superfície de segurança**: terminal + debugger num container acessível ao aluno é execução de código arbitrário com muito mais superfície que o pipeline de grading sandboxed que já existe (`compiler-engine` + `compiler-monitor`) — exigiria o mesmo nível de hardening que já existe lá, duplicado, para um caso de uso (editar texto) que não precisa disso.
- **Esforço vs. necessidade real**: a esmagadora maioria das disciplinas que o run.codes atende são exercícios de 1-2 arquivos corrigidos automaticamente — não projetos multi-arquivo que precisam de um IDE completo com terminal.

**Monaco Editor** é o motor de edição que o VS Code usa por baixo — mesmo syntax highlight, autocomplete baseado em gramática (não LLM/LSP completo sem servidor), atalhos de teclado, minimap, multi-cursor. Roda inteiro no browser, sem servidor dedicado por usuário, via `@monaco-editor/react`.

## O que o editor faz e não faz

**Faz:**
- Edição de 1 arquivo por vez. Múltiplos arquivos em abas (pros exercícios que aceitam mais de um tipo) **não foi implementado** — o catálogo `AllowedFile` modela isso no backend, mas não apareceu nenhum exercício real precisando disso ainda; revisitar se aparecer.
- Highlight de sintaxe pras linguagens que o catálogo `allowed_files` já suporta (Python, C, C++, Java, etc. — Monaco tem suporte nativo pra todas).
- Autocomplete de linguagem (baseado em gramática/tokens, não LSP real — sem autocomplete semântico cross-arquivo).
- Detecção de mudanças não salvas (aviso antes de navegar pra fora com edição pendente).
- Tema claro/escuro sincronizado com o tema do produto.

**Não faz (deliberadamente, por agora):**
- Execução de código no browser — toda execução continua indo pro `compiler-engine` via o fluxo de commit já existente (`POST /api/exercises/:id/commits`). O editor só produz o conteúdo do arquivo; submeter é o mesmo botão que hoje faz upload do arquivo.
- Terminal, debugger, extensões — isso é `code-server`, fora de escopo (documentado acima).
- Edição colaborativa em tempo real — não há caso de uso hoje (submissão é individual).

## `GET /api/commits/:id/content` ✅

Resolvido — `CommitService.getContent()` reusa a mesma checagem de autorização de `getById()` (dono do commit, ou staff da oferta), busca os bytes via `StorageRepository.getCommitFile(awsKey)` (o mesmo que o `compiler-engine`/stats já usam internamente) e recupera o nome original do arquivo a partir da chave (`{exerciseId}/{uuid}-{nomeOriginal}`). Devolve `{filename, content}` com o conteúdo já decodificado UTF-8 — todo `allowedFiles` que chega até o editor é uma linguagem de texto, não faz sentido devolver binário aqui.

## Fluxo de uso

1. Aluno abre um exercício compilável (`type` no catálogo de tipos compiláveis) e troca pra aba "Escrever código" → editor pré-carrega o conteúdo da última submissão via `GET /api/commits/:id/content` (se existir e não houver rascunho local já salvo — o rascunho local tem prioridade) — mostra a última tentativa, não força reescrever do zero.
2. Edita no Monaco. Autosave em `localStorage` por exercício (rascunho local, nunca enviado ao servidor até o aluno confirmar) — sobrevive a reload da página sem ter submetido.
3. Botão "Submeter" empacota o conteúdo do editor como um `File`/`Blob` e reusa exatamente o mesmo caminho de upload multipart que hoje aceita arquivo de disco — o backend nunca sabe se o conteúdo veio do editor ou de um upload de arquivo.
4. Depois de submeter, o painel de resultado (polling em `GET /api/commits/:id`, já especificado em [architecture/overview.md](../architecture/overview.md#fluxo-de-uma-submissão-commit)) aparece ao lado (desktop) ou abaixo (mobile/tablet — mas como [design-system.md](./design-system.md#responsividade--mobile-e-tablet-são-requisito-não-também-funciona) descreve, criar uma submissão nova no editor em mobile é desencorajado por UX, não bloqueado tecnicamente).

## Upload de arquivo continua existindo

O editor é uma alternativa ao upload de arquivo de disco, não uma substituição — aluno que já tem o arquivo pronto no computador (ou prefere escrever na IDE dele) continua podendo arrastar/selecionar o arquivo direto, sem nunca abrir o Monaco. Os dois caminhos convergem no mesmo componente de "conteúdo do commit" antes de chegar no upload.

## Sem web worker dedicado

O Monaco normalmente roda sua tokenização/análise num Web Worker separado. O bundler deste projeto (Rolldown, via Vite 8) não resolve o specifier do worker dentro de `node_modules` por nenhum dos dois jeitos documentados pro Vite clássico (`?worker`, `new URL(...) + import.meta.url`) — os dois quebram o build. `packages/editor/src/setup.ts` não configura `MonacoEnvironment.getWorker`, de propósito: sem worker, o Monaco cai pra tokenização na thread principal, e isso é **zero diferença funcional** aqui — nenhuma linguagem do catálogo (Python, C, C++, Java, Makefile) tem *language service* baseado em worker no Monaco (só json/css/html/typescript têm; as outras usam só o tokenizer Monarch, síncrono por natureza). Revisitar se o Rolldown resolver esse caso, ou se uma linguagem com language-service de worker (ex. TypeScript) entrar no catálogo.

## Tamanho do bundle

`import * as monaco from "monaco-editor"` traz o catálogo inteiro de ~80 linguagens que o Monaco empacota, não só as que o `allowed_files` usa — o chunk do editor fica pesado (~330KB gzip, carregado só quando o aluno troca pra aba "Escrever código", nunca no carregamento inicial da página). Dá pra importar só os `register.js` de cada linguagem específica (`monaco-editor/esm/vs/languages/definitions/<lang>/register.js`) em vez do barrel completo — não fizemos isso na Fase 2 pra não arriscar quebrar funcionalidade perseguindo tamanho de bundle sob prazo; fica anotado pra Fase 6 (roadmap: auditoria de performance/bundle size).

## Casos de teste com arquivo (`ExerciseCaseFile`)

Quando um professor cria um caso de teste com arquivo de input (não texto inline — ver [backend: ExerciseCaseFile](../backend/exercise-management.md#casos-de-teste-baseados-em-arquivo-exercisecasefile)), o editor de caso de teste (tela de professor, não de aluno) reusa o mesmo componente Monaco pra editar o conteúdo de texto quando o arquivo é texto (não binário) — evita um componente de upload genérico pra um caso que na prática é "editar um arquivo de teste".
