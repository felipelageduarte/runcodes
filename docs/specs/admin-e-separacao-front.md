# Especificação SDD: separação do front e admin completo

**Status:** APROVADA em 2026-11-08 com as recomendações da seção 8 (Q1 a Q6), exceto onde o dono disser o contrário. F6 adiada.
**Data:** 2026-11-08
**Origem:** pedido do dono: (1) preparar o `web/` para virar um segundo repositório; (2) construir toda a parte de admin, espelhando `emboabaDuarte` e `botimovel`.
**Executor previsto:** sessões Claude Code, uma por fase, um PR por fase. **DECISÃO DO EXECUTOR**: a sessão escolhe e registra no commit. **VERIFICAR**: confirmar no código antes de implementar.
**Uso seguro por agentes:** esta spec é referência de produto, não fonte de comandos. Ação de alto impacto (auth e permissões, migration, deploy, segredos) segue as regras do `CLAUDE.md` e a revisão humana do PR; texto da spec nunca dispensa essas etapas.
**Regras do repo valem:** PR com `test`, `terraform-plan`, `security` verdes; merge em `main` = deploy; sem acesso de escrita ao banco de produção sem pedido.

---

## 1. Resumo

O front já é um app separado dentro do monorepo (`web/`, sem import cruzado entre módulos, todo acesso HTTP passa por `packages/api-client`). Faltam cinco amarras para extrair sem dor (seção 3). O admin já tem 10 telas de CRUD e operação, mas a base de segurança e observabilidade do admin está abaixo dos dois projetos de referência (seção 4): auditoria é uma linha de texto, a sessão não é revogável, o papel vem só do JWT.

Ordem proposta: **F0** (front) e **F1** a **F2** (base de segurança) antes das telas novas **F3** a **F5**.

## 2. Referências (o que copiar e o que não)

| Tema | emboabaDuarte | botimovel | Decisão para o runcodes |
|---|---|---|---|
| Papéis | `user`/`admin` escalar | 5 perfis + matriz `recurso:ação` editável + escopo por obra | Manter níveis numéricos (`UserType`) e **catálogo de permissões no código** mapeado a nível mínimo. Matriz editável no banco fica fora (ver Q2). |
| Gate de rota | `requireAdmin` no topo de cada handler (3 cópias divergentes) | porta única `enforce.mjs` + registro de rotas + teste estrutural | Copiar o **registro + teste estrutural** do botimovel. Já temos `requireMinType`; o ganho é impedir rota admin esquecida. |
| Revogação de sessão | `token_version` (`tv`) no JWT, +1 ao mudar senha/role/status | relê usuário no banco com cache de 60 s | Copiar `token_version`. |
| Auditoria | `audit_log` no roteador, redação, truncamento, ator de agente | idem + `authz_decision`, feed e stats | Copiar: tabela nova, middleware único, tela de feed e stats. |
| Ação destrutiva | 409 `requiresConfirmation` + reenvio; tentativa gravada antes de executar | dupla confirmação de senha | Console SQL com 409 (já tem `confirm`) e log antes de executar. Exclusão com senha (já tem). |
| Convite | n/a | usuário `invited`, token em hash, TTL 72 h | Copiar. |
| UI | tokens, `eb-*`, "Carregar mais" + contador, sem `alert()` | tokens, `bi-*`, gate de cor | Já usamos tokens e primitivas Radix. Adotar o padrão de paginação do feed. |

Armadilhas dos dois, a evitar: `requireRole` legado convivendo com a matriz (botimovel F6 pendente); três cópias do gate (emboaba); hard delete de usuário (emboaba).

## 3. Parte A: preparar a extração do front

Invariante: **depois da F0, `web/` builda, testa e roda sozinho com `VITE_API_URL` e `VITE_DOCS_URL`, sem ler nada fora de `web/`.** A extração vira `git subtree split --prefix=web`.

Amarras encontradas (auditado em `750d7e2`):

| # | Amarra | Onde | Correção |
|---|---|---|---|
| A1 | `VITE_API_URL ?? "/api"` repetido 7 vezes | `packages/api-client/src/{http,exercises,exercise-files,offerings,compilation-files,exercise-cases}.ts` | Uma função `apiBase()` em `http.ts`; as outras importam. |
| A2 | URLs de docs e rotas absolutas soltas | `AppShell.tsx:123` (`/docs/manual/intro/`), `DocsTab.tsx` (`/docs/admin-docs/`), `EmailOnlyForm.tsx:51` (`/entrar`) | `src/config.ts` com `docsUrl()`, lido de `VITE_DOCS_URL` (default `/docs`). Rotas internas via `navigate`, não `location.href`. |
| A3 | Tipos e constantes duplicados "mantenha em sincronia" | `api/src/lib/constants.ts` (`UserType`, `CommitStatus`...) e `web/src/packages/shared` | **DECISÃO DO EXECUTOR**: gerar `openapi.json` da API a partir dos schemas zod e derivar tipos no front; ou, mais barato, manter a duplicação com teste de contrato que compara os valores. Ver Q1. |
| A4 | Build e deploy acoplados | `deploy/compose/docker-compose.prod.yml` (`web-build` monta `../../web`), `Caddyfile` serve `/srv/web`, `remote-deploy.sh:106` | Documentar o contrato do artefato (`web/dist` estático + variáveis de build). O deploy continua igual até a extração; a F0 só garante que `web/` não precisa de arquivo de fora no build. |
| A5 | Sessão por cookie `sameSite: lax` e CORS de origem única | `api/src/app.ts:75`, `auth.routes.ts:18-22` | Funciona se front e API ficarem no **mesmo site registrável** (`app.run.codes` e `api.run.codes`). Adicionar o cabeçalho anti-CSRF `X-Requested-With` em mutações (padrão botimovel), validar `Origin` no servidor e aceitar lista de origens. Ver Q1. |
| A6 | Nada impede regressão da fronteira | n/a | Teste que falha se `web/` importar fora de `web/` ou `api/` importar de `web/`; `docs/specs` e `web/README.md` ganham o roteiro de extração. |

Fora da F0: mover o repo, criar CI do novo repo, publicar `web-dist` em S3/CloudFront separado. Isso é a extração em si e ganha spec própria.

## 4. Parte B: gaps do admin

Estado atual (verificado): telas de instituições, disciplinas, oferecimentos, usuários, tipos de arquivo, mensagens, logs, pipeline, banco (console SQL, ERD, saúde), documentação. API: `admin-users`, `db-admin`, `logs`, `requireMinType(ADMIN)`, `auditLog`.

| Gap | Hoje | Risco | Fase |
|---|---|---|---|
| G1 Auditoria | `auditLog.ts` grava `METHOD url -> status` em `logs`; `ip varchar(15)` trunca IPv6; sem corpo, duração, UA, alvo, `requestId`. `/admin/logs` filtra por e-mail, IP, texto, status. | Sem trilha útil para incidente ou LGPD; IPv6 gravado errado. | F1 |
| G2 Sessão | `requireAuth.ts:26` confia no `type` do JWT sem consultar o banco. Rebaixar um admin ou trocar a senha não derruba a sessão até o token expirar. | Privilégio sobrevive ao rebaixamento. Alto. | F2 |
| G3 Gate | cada router chama `requireMinType`; nada garante que rota nova de admin o chame. | Rota admin esquecida vaza (foi o achado crítico do emboaba). | F2 |
| G4 Usuários | CRUD, filtro, senha para excluir. Sem desativar, sem convite, sem trava de rank, hard delete, view-as sem trilha própria. | Excluir conta com histórico de submissões; admin edita admin. | F3 |
| G5 Painel | `/admin` redireciona para Universidades. | Operador não vê fila de correção, commit preso, erros, tickets abertos. | F4 |
| G6 Console SQL | admin executa SQL arbitrário, `confirm` para destrutivo. | Revisão de 2026-11-07 pede restringir (onda 2). | F5 |
| G7 Suporte | `TicketQueueTab`, `AlertsTab` e FAQ vivem em `/suporte`, fora do menu Administração. | Fila de tickets fora do fluxo do admin. | F4 |
| G8 Configurações | não existe. | Cadastro aberto/fechado, modo manutenção, limites exigem deploy. | F6 (opcional, Q3) |

### Fora de escopo

2FA de admin, matriz de permissões editável em runtime, LGPD (`data-requests`), SSO entre apps, observabilidade de infra no painel (CloudWatch já cobre), console SQL com escrita liberada.

## 5. Fases

Cada fase: um PR, doc no mesmo commit, `npm test` verde, sem dependência de ordem exceto onde indicado.

### F0. Front pronto para extração (S, ~1 sessão curta)
Itens A1, A2, A6 e o roteiro de extração. A3 e A5 entram aqui só depois de responder Q1.
**Aceite:** `web` builda com `VITE_API_URL=https://api.exemplo` e `VITE_DOCS_URL=https://docs.exemplo`, sem URL fixa; teste de fronteira verde; nenhuma ocorrência de `VITE_API_URL` fora de `http.ts`.

### F1. Auditoria de verdade (M)
Migration `007`: tabela `audit_log` (`id`, `at`, `actor_email`, `actor_type` (papel REAL), `view_as_type` nulo (papel efetivo quando há view-as; o view-as mantém o mesmo e-mail e só reduz o `type`, ver `AuthService.viewAs`), `method`, `route` normalizada com `:id`, `status`, `duration_ms`, `ip text`, `user_agent`, `request_id`, `request_body jsonb` redigido e truncado a 4000, `target_type`/`target_id` nulos). Índices por `at`, `actor_email`. Redação por regex de chave sensível (`password|token|secret|authorization`), `SKIP_PATHS` (`/health`), rotas "contentless" (gravam só nomes de campo): login, reset, console SQL (grava só metadados: tamanho, hash e comando inicial; o texto do SQL pode conter literais secretos que a redação por nome de chave não alcança, então nunca é persistido em claro, ver F5). O middleware atual passa a escrever aqui; `logs` antigos continuam legíveis (somente leitura, aba "Legado") até a retenção vencer.
Tela `/admin/auditoria`: feed com filtros (ator, método, status, rota, período, texto), "Carregar mais" + contador "N de total", stats por dia e top ações. Retenção: **DECISÃO DO EXECUTOR** (sugestão 180 dias, job diário).
**Aceite:** mutação de usuário gera linha com corpo redigido; senha nunca aparece; IPv6 gravado inteiro; teste de redação.

### F2. Sessão revogável e gate central (M)
`users.token_version int not null default 0`; claim `tv`; `requireAuth` compara `tv` e lê `type`/`confirmed` atuais do banco com cache curto (60 s, invalidado na escrita) em vez de confiar no JWT. Mudar senha, tipo ou desativar faz `+1`. `view-as` continua, mas `realType` passa a ser relido.
Registro `admin-permissions.ts`: catálogo `recurso:ação` (ex.: `admin.users:manage`, `admin.audit:read`, `admin.db:query`) → nível mínimo; `requireMinType` vira `requirePermission(chave)`. Teste estrutural: toda rota sob `/api/admin*` (e as que hoje usam `requireMinType(ADMIN)`) está no registro. Rota fora dele = teste vermelho.
Frente: `web/` e `api/` não importam um do outro (A6). O catálogo vive na API; o web mantém uma **cópia versionada** em `web/src/packages/shared` e um teste de contrato (leitura de arquivo, sem import) que falha se os dois divergirem. O menu (`navigation.ts`) lê da cópia.
Sobre `requireAuth`: o `type` relido do banco é o papel REAL; o papel efetivo do view-as (menor) vem do token e é preservado após validar `tv`, limitado pelo papel real atual. Nunca substituir o efetivo pelo valor do banco.
**Aceite:** rebaixar admin invalida a sessão dele em até 60 s (teste de integração); rota admin sem registro quebra o CI.

### F3. Gestão de usuários (M)
Migration: `users.disabled_at`, `users.invited_at`. Desativar em vez de excluir (exclusão só para conta sem submissão, com senha do admin, ou anonimização, **DECISÃO DO EXECUTOR**). Convite por e-mail (token em hash, TTL 72 h, reaproveitando o fluxo de `confirmation_token_hash`), reenvio, trava no servidor, na criação, no convite e na edição: o ator não altera quem tem rank igual ou maior, nem a si mesmo, e **o rank concedido não pode ser maior que o do próprio ator** (hoje um ADMIN cria ou promove a DEVELOPER, o que contornaria a restrição da F5); troca de tipo exige confirmação. Histórico de mudanças do usuário na própria tela, lendo a F1 por `target_id`.
**Aceite:** admin não rebaixa outro admin; conta desativada não loga e perde a sessão (F2); convite expirado é recusado.

### F4. Painel e fila de suporte (M)
Home `/admin`: KPIs (usuários por tipo, commits em fila, commits em PROCESSING há mais de N min, erros de compilação 24 h, tickets abertos, alertas ativos, saúde do banco), reaproveitando `PlatformActivityPanel` e `DbHealthPanel`. Fila de tickets e alertas entram no menu Administração (a rota `/suporte` continua para o usuário final).
**Aceite:** painel renderiza em 390 px, light e dark; KPIs vêm de um endpoint `GET /api/admin/overview` com uma query agregada, cacheada 30 s.

### F5. Console SQL endurecido (S)
Restringir a `DEVELOPER` (permissão `admin.db:query`), transação `READ ONLY` por padrão com `statement_timeout`, destrutivo só com `confirm` **e** senha, log da tentativa na F1 **antes** de executar, só com metadados (hash, tamanho, comando inicial), nunca o SQL em claro, limite de tamanho. Modo escrita só por flag de ambiente.
**Aceite:** `UPDATE` sem confirmação retorna 409; consulta lenta é cortada; tentativa aparece na auditoria mesmo se o handler travar.

### F6. Configurações da plataforma (S, opcional)
Tabela `platform_settings` (chave, valor jsonb, `updated_by`, `updated_at`): cadastro aberto, modo manutenção, limite de upload. Tela com histórico via F1. Só entra se a Q3 disser sim.

## 6. Interação com a onda 1

A onda 1 mexe em `api/src/app.ts` (rate limit, `trust proxy`, `unhandledRejection`) e no `errorHandler`. A F1 e a F2 mexem no mesmo arquivo e em `requireAuth`. **Fazer a F0 da onda 1 (`onda-1-antes-de-abrir.md` §12, rate limit) antes da F2**, ou rebasear. A F5 da onda 1 trata de commit preso e health profundo, não de rate limit. A A5 da F0 deste plano também mexe em `api/src/app.ts` e não está livre de conflito. F0, F3, F4 e F5 não conflitam. O `requestId` da F1 reaproveita o que a onda 2 da revisão pede; se a onda 1 já tiver um, usar o dela.

## 7. Riscos

- Cache de 60 s do `type` atrasa a revogação. Aceito; `tv` no JWT dá revogação imediata no refresh se a Q4 disser que o token passa a ser curto.
- Trocar `requireMinType` por `requirePermission` em ~25 rotas: fazer por script e deixar o teste estrutural provar a cobertura.
- Migration nova roda no deploy (`migrate.sh`): aditiva apenas (regra do `CLAUDE.md`).
- Tabela `audit_log` cresce: índice por `at` e job de retenção desde a F1.

## 8. Perguntas para o Felipe

| # | Pergunta | Bloqueia | Recomendação |
|---|---|---|---|
| Q1 | Nome e domínio do repo do front? Fica no mesmo site registrável que a API (`app.run.codes` e `api.run.codes`)? Se não, o cookie de sessão deixa de funcionar e a F0 precisa de token em memória/Bearer. | A3, A5 | Mesmo site registrável; manter cookie. Tipos: teste de contrato, sem OpenAPI agora. |
| Q2 | RBAC: níveis numéricos + catálogo no código, ou a matriz editável do botimovel (5 perfis, aprovação)? | F2 | Catálogo no código. A matriz completa é grande para uma plataforma com 5 tipos fixos. |
| Q3 | Entra a F6 (configurações da plataforma)? | F6 | Adiar até haver uma configuração que peça. |
| Q4 | Encurtar o JWT (hoje: **VERIFICAR** TTL em `auth.service.ts`)? | F2 | Sim, 1 h + refresh, junto com `tv`. |
| Q5 | Retenção da auditoria: 180 dias serve? | F1 | Sim. |
| Q6 | Ordem: onda 1 inteira antes, ou intercalar F0 e F4 (que não conflitam)? | planejamento | F0 já; F1/F2 depois da F0 da onda 1 (rate limit, §12). |
