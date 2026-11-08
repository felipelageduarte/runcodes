# Especificação SDD: Onda 1, correções obrigatórias antes do primeiro aluno real

**Status:** PROPOSTA, aguardando respostas das perguntas da seção 11 e 13.1 (Felipe). Sessão de origem arquivada em 2026-11-08; retomar pela seção 13. Fases independentes podem começar antes; a ordem sugerida está na seção 5.
**Data:** 2026-11-08
**Origem:** revisão completa de 2026-11-07 (`docs/reviews/2026-11-07-revisao.md`, Top 1 a 8, §7 "Agora"). Sete itens de severidade alta, esforço S-M, que a revisão coloca como condição para abrir o sistema a alunos. A auditoria de outubro do sandbox (`compiler-sandbox/docs/security-audit-2026-10.md`) já pedia dois deles (R3 e R15) e nenhum foi feito.
**Executor previsto:** sessões Claude Code posteriores, uma por fase, cada uma com PR próprio. Onde a spec diz **DECISÃO DO EXECUTOR**, a sessão escolhe e registra no commit; onde diz **VERIFICAR**, confirma no código antes de implementar. Números de linha valem para `main` em `7da880d`.
**Regras do repositório continuam valendo:** `CLAUDE.md` (PR obrigatório com `test`, `terraform-plan`, `security` verdes; merge em `main` = deploy em produção; nada à mão na AWS; segredos só no SSM; banco de produção leitura por padrão).

---

## 1. Resumo e decisões de topo

Hoje o código do aluno roda num container sem rede e sem capabilities (bom), mas sem teto de memória, processos ou CPU, como root, e o processo que o supervisiona (`rcc`) lê arquivos que o aluno controla com `open()` simples enquanto carrega no ambiente a senha do banco e as chaves do S3. Do lado da operação, nenhuma falha da aplicação gera alerta: exceção da API vira `console.error` no disco do host, commit preso em PROCESSING fica preso para sempre, container em loop de restart é invisível, e os logs morrem com a instância.

Esta spec fecha isso em sete fases pequenas. Nada de arquitetura nova: a revisão concluiu que a EC2 única está certa para o porte e que serverless custaria mais.

### Decisões já tomadas (não reabrir sem conversar com o Felipe)

- **D1. Limites de recurso são por linguagem, com default global, e vivem em `compiler/src/rcc/languages.py`.** O comentário em `container.py:36-42` diz que faltava um lugar configurável por linguagem; esse lugar é a classe `Language`. Nada de número único hardcoded no `containers.run`.
- **D2. Default do executor passa a ser conservador: concorrência 2, não 8.** `config.py:17 DEFAULT_CONCURRENCY = 8` e `docker-compose.prod.yml:122 ${RC_COMPILER_CONCURRENCY:-8}` viram 2 e `:?` respectivamente. O Terraform já diz 2 (`variables.tf:52`). Quem quiser mais sobe explicitamente.
- **D3. Toda leitura de arquivo que o aluno pode ter escrito passa por uma única função `safe_open()` que recusa symlink e não-regular.** Não se corrige ponto a ponto; cria-se a função e proíbe-se `open()` direto nesses módulos por teste estrutural.
- **D4. O aluno roda como usuário sem privilégio dentro do container, via `user=` no `containers.run`, não via `-u` do monitor.** Motivo: `user=` vale para compilação, execução e qualquer `eval` dos `pre_*_command` do `base-script.sh`; o `-u` do monitor só vale dentro do `monitor`. O `-u` pode continuar como segunda camada. Isso exige que o workspace seja legível/gravável pelo uid escolhido (hoje `0o777`, `common.py`), e que o `base-script.sh` não dependa de root (**VERIFICAR** `chmod 644 "../${test_id}.in"`, linha ~172, e qualquer escrita em `/usr`).
- **D5. Rate limit usa o Redis que já existe (`ioredis` em `api/package.json:31`), com `trust proxy` configurado para o CloudFront.** Contador em memória não serve: a API pode ter mais de um processo no futuro e o limite precisa sobreviver a restart. O IP confiável é o que o CloudFront informa (`X-Forwarded-For` do último salto confiável), nunca um cabeçalho que o cliente escolhe.
- **D6. Alertas novos seguem o padrão já existente: métrica no namespace `Runcodes` emitida por timer systemd, alarme no Terraform com `treat_missing_data = "breaching"`, SNS existente.** Mesmo mecanismo de `BackupSuccess` (`backup.sh:17-20`, `monitoring.tf:89-102`). Nenhum agente novo, nenhum SaaS.
- **D7. Logs vão ao CloudWatch pelo driver `awslogs` do Docker, não pelo agente.** Menos uma peça de configuração; o agente continua só com métricas. Um log group por serviço do compose, retenção 30 dias, criados no Terraform.
- **D8. Varredura de PROCESSING preso vive no `rcc` (poller), não em timer externo.** O poller já tem o ciclo e o `DataProvider`; um `requeue_stale_processing()` por ciclo é a mudança menor. O timer externo só emite a métrica (D6), não corrige.
- **D9. Uma fase = um PR = um deploy.** Nenhuma fase depende de outra para ir à `main`, exceto F6 que precisa dos log groups de F4 para o metric filter.

### Fora de escopo (decisão deliberada; está na onda 2 ou 3 da revisão)

Socket proxy e `rcc` não-root; gVisor; credenciais por serviço e `hop_limit=1`; JWT curto; console SQL do admin; LGPD; helper `isNotFound` nos 27 repositórios; `requestId`/log JSON; métricas de negócio; S3 real no lugar do Seaweed; build de imagens no CI; refatoração do `remote-deploy.sh`.

---

## 2. Contexto: o que existe hoje (auditado em 2026-11-07, não redescobrir)

| Peça | Onde | Estado |
|---|---|---|
| Container do aluno | `compiler/src/rcc/engine/container.py:42-44, 186-196` | `network_mode="none"`, `cap_drop=["ALL"]`, `security_opt=["no-new-privileges"]`. Sem `mem_limit`, `memswap_limit`, `pids_limit`, `nano_cpus`, `ulimits`, `user`, `read_only`. Volume `remote_dir:/root` rw. Imagem `ghcr.io/runcodes-icmc/runcodes-compiler-images-<lang>:latest` (`languages.py:6`). |
| Linguagens | `compiler/src/rcc/languages.py` classe `Language(name, extensions, compilable, image_name)` e lista `KNOWN_LANGUAGES` (C, C++, C#, Fortran, Go, Haskell, Java, ... **VERIFICAR** lista completa) | Sem campo de limite. |
| Concorrência | `config.py:17` default 8; compose `:-8`; Terraform default 2 injetado via `.env` (`RC_COMPILER_CONCURRENCY`) | Host t4g.small 2 GB com swap. |
| Leituras do workspace pelo `rcc` | `container.py:150 _read_compilation_error_file` (`open(fname, errors="replace")`); `grading.py:51` (`open(run_info_fname)`), `:71` (`os.stat(user_err_fname)`), `:109 _read_capped`; `workspace.py:226` (`open(fname,"a")` truncate), `:235` (`os.walk(output_dir)`) e `prepare_output_file` que zipa | Todos seguem symlink. O aluno é root no container e controla `/root` (= `remote_dir`), onde ficam `compilation.err`, `<id>.output`, `<id>.err`, `run_info`. |
| Ambiente do `rcc` | `docker-compose.prod.yml:115-136` | `RUNCODES_DB_PASSWORD`, `RUNCODES_S3_CREDENTIALS_KEY/SECRET`, socket Docker, `/exec` do host. |
| Usuário no container | `compiler-images/base/Dockerfile` (`FROM debian:trixie-slim`, copia `monitor` e `runcodes`), `base-script.sh:107,172` chamam `monitor` sem `-u`; nenhuma imagem tem `USER` | Auditoria R3 (alto). O monitor já suporta `-u uid:gid` (`compiler-sandbox/README.md`). |
| API: borda | `api/src/app.ts:69-73`: `helmet()`, `cors`, `express.json()`, `cookieParser()`; sem `trust proxy`, sem rate limit | Caddy na frente, CloudFront na frente do Caddy. |
| API: login | `auth.routes.ts:30 POST /login`, `:68 /view-as`; `auth.service.ts:39,48` comparam hash legado com `===` | Sem contador de tentativas. Signup/reset: **VERIFICAR** rotas em `users.routes.ts`. |
| API: erros | `errorHandler.ts:16` `console.error(err)` + 500; `server.ts` só trata SIGTERM/SIGINT; nenhum `unhandledRejection` | |
| API: health | `health.routes.ts:7-9` estático `{status:"ok"}` | Route53 (`monitoring.tf:120-145`) e deploy apontam para `/api/health`. O smoke do deploy já toca `/api/universities`. |
| Fila de correção | `poller.py` refaz `fetch_commits_in_queue()` (`status = IN_QUEUE`) a cada ciclo; `postgres.py:294 claim_commit` (IN_QUEUE→PROCESSING, seta `compilation_started`); `:325 release_commit` só no worker vivo | `commits.compilation_started timestamp` (schema linha 165); índice `idx_commits_status`. Sem varredura de PROCESSING antigo. Sem contador de tentativas no schema. |
| Compose | `docker-compose.prod.yml` | Nenhum `healthcheck:`. Todos `restart: unless-stopped`. |
| Logs | `host-setup.sh:90-96` `daemon.json` com `json-file` 10m x 3; agente CW (`:114-127`) só `metrics` | Só o flow log da VPC vai ao CloudWatch (`network.tf:53`). |
| Alarmes | `monitoring.tf`: status check, cpu credits, disco, memória, backup-stale, health, cf_5xx | SNS por e-mail. Padrão de métrica própria: `Runcodes/BackupSuccess`. |
| Role da instância | `ec2.tf:39-70` | Tem `CloudWatchAgentServerPolicy` (inclui `logs:*` necessários ao driver `awslogs`: **VERIFICAR** `logs:CreateLogStream`, `PutLogEvents`, `DescribeLogStreams`). |
| Testes | `compiler`: unittest `test_*.py` de topo no CI, `tests/engine` exige Docker; `api`: vitest, `full-flow.integration.test.ts`; `infra`: `node --test infra/scripts/*.test.mjs` | |

---

## 3. Princípios e invariantes

- I1. Código do aluno nunca roda como uid 0 dentro do container.
- I2. Um container de aluno não consegue consumir mais que o teto da sua linguagem em memória, pids, CPU e tamanho de arquivo; a soma dos tetos vezes a concorrência cabe na RAM do host com folga para banco e API.
- I3. O `rcc` nunca abre, lê, `stat`a ou zipa um caminho dentro do workspace sem antes garantir que é arquivo regular e não symlink.
- I4. Toda rota de autenticação e de escrita pública tem limite de tentativas por IP confiável e por conta, com resposta 429 e `Retry-After`.
- I5. Toda falha da aplicação (500, exceção não tratada, commit preso, container unhealthy) gera notificação em até 10 minutos sem ninguém olhar o host.
- I6. Nenhuma mudança desta spec altera o formato de saída do executor nem o schema do banco (exceto o índice opcional de F5).

---

## 4. Fases

### F1. Limites de recurso no container do aluno (Top 1)

**Arquivos:** `compiler/src/rcc/languages.py`, `compiler/src/rcc/engine/container.py`, `compiler/src/rcc/config.py`, `deploy/compose/docker-compose.prod.yml`, `compiler/README.md`, testes em `compiler/tests/` (topo) e `compiler/src/rcc/tests/`.

**Desenho:**

1. `Language` ganha campo `limits: ResourceLimits` (dataclass: `mem_bytes`, `pids`, `nano_cpus`, `fsize_bytes`, `nofile`). Default global em `config.py`: `mem 256 MiB`, `pids 64`, `nano_cpus 1e9` (1 vCPU), `fsize 64 MiB`, `nofile 256`. Overrides na lista `KNOWN_LANGUAGES`: Java e C# `mem 768 MiB`; `c-omp`, `c-omp-mpi`, `cpp-omp*` `pids 256`, `nano_cpus 2e9`. **DECISÃO DO EXECUTOR:** valores finais; a regra é `max(mem) * concorrência + 1 GiB <= RAM do host`, e com concorrência 2 numa t4g.small isso dá no máximo ~512 MiB por container. Se Java não couber, documentar que Java exige t4g.medium ou concorrência 1.
2. Variáveis de ambiente opcionais sobrescrevem o default global (`RUNCODES_COMPILER_MEM_MB`, `_PIDS`, `_CPUS`), lidas em `config.py` no mesmo padrão de `RUNCODES_COMPILER_CONCURRENCY`.
3. `containers.run` recebe `mem_limit`, `memswap_limit` (= `mem_limit`, sem swap), `pids_limit`, `nano_cpus`, `ulimits=[Ulimit(name="fsize", ...), Ulimit(name="nofile", ...)]`. Remover o comentário "intentionally NOT added".
4. `DEFAULT_CONCURRENCY = 2`; compose `${RC_COMPILER_CONCURRENCY:?defina RC_COMPILER_CONCURRENCY no .env}`. **VERIFICAR** que `remote-deploy.sh` grava `RC_COMPILER_CONCURRENCY` no `.env` a partir do SSM/Terraform (hoje o default 2 do Terraform chega como?).
5. Quando o container morre por OOM (`container.wait()` devolve `OOMKilled` ou status 137), o commit recebe status de erro com mensagem clara ao aluno ("limite de memória excedido"), não "erro interno". **VERIFICAR** como `_teardown_container` e `_run_execution` tratam o código de saída hoje.

**Testes:** unitário para `ResourceLimits` por linguagem e para o override por env; unitário para o mapeamento OOM→mensagem; em `tests/engine` (manual, Docker), um teste que roda `:(){ :|:& };:` e um `malloc` de 1 GiB em C e espera erro limpo com o host íntegro.

**Aceite:** fork bomb e alocação de 1 GiB numa submissão C terminam em erro de submissão em menos de 10 s e `docker stats` do host não passa de 60% de RAM; nenhuma submissão legítima dos exercícios de exemplo muda de resultado.

**Esforço:** S (1 dia).

### F2. Leitura segura do workspace (Top 2)

**Arquivos:** novo `compiler/src/rcc/engine/safe_io.py`; `container.py`, `grading.py`, `workspace.py`; teste estrutural novo.

**Desenho:**

1. `safe_io.py` com `open_regular(path, mode="r", **kw)`: `fd = os.open(path, O_RDONLY|O_NOFOLLOW|O_CLOEXEC)`, `fstat`, exige `S_ISREG`, senão `UnsafePathError`; devolve `os.fdopen(fd, ...)`. Variante `stat_regular(path)` com `os.lstat` + `S_ISREG`. Para escrita (`truncate` em `workspace.py:226`): `O_WRONLY|O_NOFOLLOW|O_APPEND`.
2. Substituir: `container.py:150`, `grading.py:51,71,109`, `workspace.py:226`. Em `prepare_output_file` (`workspace.py:221-245`), o `os.walk` usa `followlinks=False` (já é o default, **VERIFICAR**) e cada arquivo zipado passa por `stat_regular`; symlink ou não-regular é pulado com log `warning` contendo `commit.id` e o caminho.
3. Diretório intermediário com symlink ainda é seguido por `O_NOFOLLOW` (só o último componente). Mitigação nesta fase: os caminhos lidos são sempre `base_dir/<nome fixo>` com um só nível; o teste estrutural garante que nenhum caminho lido tem subdiretório. Com F3 (aluno não-root) o risco residual cai mais. `openat2(RESOLVE_NO_SYMLINKS)` fica como opção na onda 2.
4. `UnsafePathError` vira erro de submissão ("saída inválida"), nunca exceção não tratada, e conta numa métrica de log (`logger.warning("unsafe_path", commit_id=...)`) para F6 alarmar se repetir.

**Testes:** unitário que cria workspace temporário com `compilation.err -> /etc/hostname` e espera `UnsafePathError`; idem para FIFO e diretório; teste estrutural (`grep`/AST) que falha se `open(` ou `os.stat(` aparecer em `container.py`, `grading.py`, `workspace.py` fora de `safe_io`.

**Aceite:** submissão com `Makefile` que faz `ln -sf /proc/self/environ ../compilation.err` resulta em erro de submissão sem nenhum byte do ambiente do `rcc` em `commits.compiled_error` nem no zip de saída.

**Esforço:** S (meio dia a 1 dia).

### F3. Aluno não-root no container (Top 5, auditoria R3)

**Arquivos:** `compiler-images/base/Dockerfile`, `compiler-images/base/base-script.sh`, `compiler-images/*/Dockerfile` (**VERIFICAR** quais instalam pacotes em runtime), `compiler/src/rcc/engine/container.py`, `compiler/src/rcc/engine/workspace.py` ou `common.py` (permissões do workspace), `compiler-images/README.md`.

**Desenho:**

1. Imagem base: `RUN groupadd -g 65532 runner && useradd -u 65532 -g 65532 -M -s /usr/sbin/nologin runner`. Sem `USER` no Dockerfile (o `rcc` decide), para que builds derivados que precisem de `apt` continuem funcionando.
2. `containers.run(..., user="65532:65532")`. **DECISÃO DO EXECUTOR:** se alguma linguagem exigir escrita fora de `/root` (cache do Go, `~/.m2`, `dotnet` first-run), apontar `HOME`/`XDG_CACHE_HOME` para dentro do workspace ou para um `tmpfs` (`tmpfs={"/tmp": "size=64m"}`), nunca voltar a root.
3. Workspace: o `rcc` cria `base_dir` e copia arquivos; antes de subir o container, `os.chown(-R, 65532, 65532)` no `base_dir` e `0o750` em diretórios, `0o640` em arquivos (substitui o `0o777` de `common.py`). `.in` fechados: hoje `chmod 644` no script (`base-script.sh:172`); com dono `runner` o aluno continua lendo os `.in` do próprio teste. Isolamento por teste (auditoria E11) fica fora desta fase; o ganho aqui é fechar a troca do `monitor` e a escrita em `/usr`.
4. `base-script.sh`: remover ou guardar o `chmod 644` (já é dono); passar `-u 65532:65532` ao monitor como camada extra é opcional. **VERIFICAR** cada `eval` de `pre_compilation_command`/`pre_run_command` nas imagens: nenhum pode exigir root.
5. Monta `/root` como hoje, mas **DECISÃO DO EXECUTOR:** avaliar `read_only=True` no rootfs com `tmpfs` em `/tmp`; só se nenhuma imagem quebrar.
6. As imagens são publicadas em `ghcr.io/runcodes-icmc/...:latest` por outro repo (**VERIFICAR** onde roda o build: `compiler-images/Makefile` e workflow). Esta fase precisa de um build e push novo de todas as imagens; enquanto a tag for `:latest`, o deploy puxa a nova automaticamente, o que é também o risco (ver seção 7). Fixar por digest é onda 2.

**Testes:** `tests/engine` com submissão que tenta `cp /bin/true /usr/bin/monitor` e `id -u`; espera falha de permissão e uid 65532. Conjunto de exercícios de exemplo em todas as linguagens com resultado idêntico ao de antes.

**Aceite:** `id -u` dentro de uma submissão retorna 65532; troca do `monitor` falha; suíte de exemplo passa em todas as linguagens com imagem publicada.

**Esforço:** M (2 a 3 dias, a maior parte em testar as 24 imagens).

### F4. Logs dos containers no CloudWatch (Top 4)

**Arquivos:** `infra/scripts/host-setup.sh` (`setup_docker`), novo `infra/terraform/logs.tf`, `deploy/compose/docker-compose.prod.yml` (opcional, ver 2), `infra/docs/operacao.md`.

**Desenho:**

1. `daemon.json`: `"log-driver": "awslogs"`, `"log-opts": {"awslogs-region": "<região>", "awslogs-group": "/runcodes/docker", "awslogs-create-group": "false", "tag": "{{.Name}}"}`. Região vem do IMDS no `host-setup.sh` (já há padrão em `backup.sh:10`). **DECISÃO DO EXECUTOR:** um grupo único `/runcodes/docker` com stream por container (`tag`) ou um grupo por serviço via `logging:` no compose. Um grupo por serviço facilita metric filter da F6 e retenção diferente; recomenda-se por serviço: `/runcodes/api`, `/runcodes/rcc`, `/runcodes/plagiarism-worker`, `/runcodes/caddy`, `/runcodes/database`, `/runcodes/seaweed`, `/runcodes/redis`.
2. `logs.tf`: `aws_cloudwatch_log_group` para cada um, `retention_in_days = 30`, tags padrão. Reduzir o flow log (`network.tf:55`) de 365 para 90 dias no mesmo PR (achado F4/O12 da revisão).
3. IAM: confirmar que `CloudWatchAgentServerPolicy` cobre `logs:CreateLogStream`, `logs:PutLogEvents`, `logs:DescribeLogStreams` (cobre). Com `awslogs-create-group=false`, grupo ausente derruba o container na subida: por isso o Terraform aplica antes do `remote-deploy.sh` (ordem já garantida pelo `deploy.sh`).
4. `host-setup.sh` reinicia o Docker se o `log-driver` divergir (hoje só compara `data-root`, linha ~113). Containers existentes mantêm o driver antigo até serem recriados; o `compose up` do deploy recria.
5. `operacao.md`: como ler logs (`aws logs tail /runcodes/api --follow`) e que `docker logs` deixa de funcionar com `awslogs` (limitação conhecida do driver; aceitável; alternativa `"mode": "non-blocking"` para não travar a app se o CloudWatch cair).

**Testes:** `node --test` não cobre; validação no deploy: após o merge, `aws logs tail /runcodes/api --since 5m` mostra a linha `api-node listening on :3000`.

**Aceite:** log de cada serviço visível no CloudWatch com retenção 30 dias; instância destruída não perde logs; `docker info` mostra `awslogs`.

**Esforço:** S (meio dia). Risco: Docker não sobe se `awslogs-region` estiver errado; testar numa instância descartável antes da `main` (lição de 06/11 no `CLAUDE.md`).

### F5. Commit preso em PROCESSING: recuperação e alarme; health profundo (Top 6)

**Arquivos:** `compiler/src/rcc/provider/data/data_provider.py`, `postgres.py`, `engine/poller.py`, `config.py`; novo `infra/scripts/metrics.sh` + unidades systemd em `host-setup.sh`; `infra/terraform/monitoring.tf`; `api/src/http/routes/health.routes.ts`; `infra/scripts/deploy.sh`.

**Desenho:**

1. `DataProvider.requeue_stale_processing(older_than: timedelta, max_attempts: int) -> int`. Em Postgres: `UPDATE commits SET status = IN_QUEUE, compilation_started = NULL WHERE status = PROCESSING AND compilation_started < now() - %s RETURNING id`. Contador de tentativas: o schema não tem coluna; **DECISÃO DO EXECUTOR** entre (a) migration aditiva `007_commits_attempts.sql` com `attempts smallint default 0` incrementada no `claim_commit`, ou (b) usar `release_commit` só até N vezes por id em memória do poller. (a) é correto e sobrevive a restart; (b) é zero-schema. Recomenda-se (a); a migration entra em `api/db/migrations/` e roda no deploy (`migrate.sh`). Ao estourar `max_attempts`, status `ERROR` com `compiled_error = "correção interrompida; contate o professor"`.
2. Poller chama `requeue_stale_processing` uma vez por ciclo, antes do fetch. Janela: `RUNCODES_COMPILER_STALE_AFTER_S` default 900 (15 min; precisa ser maior que o pior caso de `base_exec_timeout*(1+casos)+cpu`, **VERIFICAR** em `config.py`). Log `warning` com os ids requeued.
3. `metrics.sh` (timer systemd a cada 5 min, mesmo padrão do backup): consulta via `docker compose exec -T database psql -tA` e emite no namespace `Runcodes`: `StuckSubmissions` (PROCESSING há mais de 15 min), `QueuedSubmissions` (IN_QUEUE), `OldestQueuedAgeSeconds`, `ContainersUnhealthy` (ver F7), `ContainerRestarts` (soma de `RestartCount` do `docker inspect`). Falha do script emite nada, e o alarme com `breaching` cobre.
4. `monitoring.tf`: alarme `runcodes-submissions-stuck` (`StuckSubmissions > 0`, 2 períodos de 5 min, `breaching`), `runcodes-queue-old` (`OldestQueuedAgeSeconds > 1800`, `notBreaching`).
5. `GET /api/health/deep`: `SELECT 1` via Prisma com timeout de 2 s, `HeadBucket` no S3/Seaweed com timeout de 2 s, `PING` no Redis; responde 200 `{db, s3, redis}` ou 503 com o componente que falhou. Sem autenticação, sem detalhe de erro (só `ok|fail`). Route53 (`monitoring.tf` `resource_path`) e `deploy.sh` passam a usar `/api/health/deep`; `/api/health` continua para o Caddy/CloudFront.
6. Índice: `idx_commits_status` existe; a consulta `status = PROCESSING AND compilation_started < ...` é seletiva o bastante. Sem índice novo.

**Testes:** unitário do provider com banco fake (padrão dos testes atuais, **VERIFICAR** `compiler/src/rcc/tests`); unitário do poller que injeta um provider com 1 stale e verifica 1 requeue e 1 log; vitest do `/health/deep` com Prisma mockado falhando → 503; `infra/scripts/metrics.test.mjs` não se aplica (bash); `bash -n` + execução manual via SSM antes da `main`.

**Aceite:** matar o `rcc` no meio de uma correção (`docker kill`) e subir de novo: o commit volta a IN_QUEUE em até 15 min e é corrigido; com o banco parado, `/api/health/deep` dá 503 e o alarme `health-check-failed` dispara em até 3 min; `StuckSubmissions` aparece no CloudWatch a cada 5 min.

**Esforço:** M (2 dias).

### F6. Alarme de erro da API e de exceção não tratada (Top 8a)

**Arquivos:** `api/src/http/middleware/errorHandler.ts`, `api/src/server.ts`, `api/src/worker.ts`, `infra/terraform/monitoring.tf` (metric filter + alarme), depende de F4.

**Desenho:**

1. `errorHandler.ts`: no caminho 500, logar uma linha JSON `{"level":"error","event":"internal_error","method","path","err":{name,message,stack}}` via `console.error(JSON.stringify(...))`. Sem `pino` nesta fase (onda 3); o metric filter só precisa de um marcador estável: `"internal_error"`.
2. `server.ts` e `worker.ts`: `process.on("unhandledRejection")` e `process.on("uncaughtException")` logam `{"level":"fatal","event":"unhandled", ...}` e saem com código 1 (o `restart: unless-stopped` religa; F7 conta os restarts).
3. `monitoring.tf`: `aws_cloudwatch_log_metric_filter` no grupo `/runcodes/api` com pattern `"internal_error"` → métrica `Runcodes/ApiInternalErrors`; idem `"\"level\":\"fatal\""` em `/runcodes/api` e `/runcodes/plagiarism-worker` → `Runcodes/ProcessCrashes`. Alarmes: `ApiInternalErrors >= 1` em 5 min (`notBreaching`), `ProcessCrashes >= 1` em 5 min.
4. Com poucos usuários, 1 erro já dispara; aceitável agora. Quando o volume subir, trocar o limiar por taxa.

**Testes:** vitest do `errorHandler` verificando a linha JSON com `internal_error`; teste manual: rota que lança (`/api/__boom` só em `NODE_ENV!=production`, ou mock) → alarme em até 5 min.

**Aceite:** um 500 em produção gera e-mail do SNS em até 5 min com o nome do alarme.

**Esforço:** S (meio dia) após F4.

### F7. Healthcheck dos containers e alarme de restart em loop (Top 8b)

**Arquivos:** `deploy/compose/docker-compose.prod.yml`, `infra/scripts/metrics.sh` (de F5), `infra/terraform/monitoring.tf`.

**Desenho:**

1. `healthcheck:` no compose: `api` (`wget -qO- http://127.0.0.1:3000/api/health`), `database` (`pg_isready -U postgres`), `redis` (`redis-cli ping`), `seaweed` (`wget -qO- http://127.0.0.1:8333`), `rcc` (**DECISÃO DO EXECUTOR:** arquivo de heartbeat `/tmp/rcc-alive` tocado pelo poller a cada ciclo, `test $(find /tmp/rcc-alive -mmin -2)`), `plagiarism-worker` (heartbeat igual). Intervalos 30 s, `start_period` 60 s, `retries` 3. **VERIFICAR** que as imagens têm `wget`/`pg_isready`/`redis-cli`.
2. `depends_on` com `condition: service_healthy` para `api` → `database`, `redis`, `seaweed`; `rcc` → `database`, `seaweed`. Isso também remove a corrida de subida que o `remote-deploy.sh` contorna com loops de `pg_isready`.
3. `metrics.sh` emite `ContainersUnhealthy` (contagem de `Health.Status != healthy` entre os que têm healthcheck) e `ContainerRestarts` (delta de `RestartCount` desde a última execução, guardado em `/var/lib/runcodes/restarts.json`).
4. Alarmes: `runcodes-containers-unhealthy` (`> 0`, 2 períodos, `breaching`), `runcodes-container-restarts` (`>= 3` em 15 min, `notBreaching`).

**Testes:** `docker compose config` válido no CI (adicionar ao job `test`: `docker compose -f deploy/compose/docker-compose.prod.yml --env-file <exemplo> config -q`; **VERIFICAR** se existe `.env.example`); teste manual: `docker kill rcc` → `ContainersUnhealthy=1` no próximo tick e alarme em 10 min.

**Aceite:** `docker compose ps` mostra `healthy` em todos; container em loop gera e-mail em até 15 min.

**Esforço:** S (1 dia).

---

## 5. Ordem e dependências

```
F1 limites ──┐
F2 safe_io ──┼── independentes, começar por aqui (maior risco, menor esforço)
F3 não-root ─┘   (F3 depois de F1 e F2: mesma área, evita conflito)
F4 logs ──────── F6 alarme de erro da API (precisa dos log groups)
F5 stuck + deep health ── F7 healthcheck (compartilham metrics.sh; F5 primeiro)
```

Sugestão: semana 1 = F1, F2, F4, F5; semana 2 = F3, F6, F7. Total ~7 a 9 dias de sessão.

---

## 6. Monitoramento (parte da feature)

Ao fim da onda, o namespace `Runcodes` tem: `BackupSuccess` (existente), `StuckSubmissions`, `QueuedSubmissions`, `OldestQueuedAgeSeconds`, `ContainersUnhealthy`, `ContainerRestarts`, `ApiInternalErrors`, `ProcessCrashes`. Alarmes novos: `submissions-stuck`, `queue-old`, `containers-unhealthy`, `container-restarts`, `api-internal-errors`, `process-crashes`. Todos no SNS existente. `operacao.md` ganha uma linha de runbook por alarme (o que olhar, comando SSM). `lifecycle.sh pause` silencia também os novos (**VERIFICAR** como ele lista alarmes hoje).

Teste de ponta a ponta obrigatório na última fase: `aws cloudwatch set-alarm-state --state-value ALARM` em um alarme novo e confirmar o e-mail; registrar a data em `operacao.md` (achado O9 da revisão).

---

## 7. Entrega sem risco

- Cada fase é um PR com CI verde e merge pelo Felipe; o merge aplica em produção.
- F3 e F4 mexem no host e nas imagens: validar numa instância descartável (`terraform apply` com `-var instance_type=...` num workspace separado, ou `docker run` local em arm64) antes de ir à `main`; lição registrada no `CLAUDE.md` em 06/11.
- F3 depende de publicar imagens novas em `ghcr.io/runcodes-icmc`. Enquanto a tag for `:latest`, publicar as imagens e mergear o PR do `rcc` no mesmo dia; a ordem segura é `rcc` primeiro (que passa `user=`) só se as imagens novas já tiverem o usuário 65532, senão `containers.run` falha com "unable to find user". Logo: imagens primeiro, depois o PR do `rcc`.
- Rollback: cada fase é revertível por `git revert` + merge; F4 exige também recriar os containers para voltar ao `json-file`.
- Banco: só F5 opção (a) toca o schema, com migration aditiva.

---

## 8. Testes transversais

- CI: nenhuma fase pode baixar a cobertura; F2 adiciona teste estrutural; F7 adiciona `compose config`.
- Antes de fechar a onda: rodar a suíte de exercícios de exemplo em todas as linguagens (manual, `tests/engine`), comparar com baseline de antes da F1.
- Smoke pós-deploy (`deploy.sh`) passa a chamar `/api/health/deep` (F5).

## 9. Documentação a atualizar junto

`CLAUDE.md` (seção Produção: health deep, logs no CloudWatch, concorrência default 2), `infra/docs/operacao.md` (logs, alarmes novos, runbooks), `compiler/README.md` (limites por linguagem, usuário 65532), `compiler-images/README.md` (usuário `runner`, o que uma imagem nova precisa respeitar), `compiler-sandbox/docs/adr-sandbox-isolation.md` (atualizar o status: R3 e R15 feitos; decisão sobre gVisor segue aberta), `docs/reviews/2026-11-07-revisao.md` (marcar Top 1, 2, 4, 5, 6, 8 como feitos com data).

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Limites quebram linguagem pesada (Java, MPI) | Override por linguagem (D1); suíte de exemplo antes e depois; mensagem clara de OOM ao aluno. |
| Imagem com `apt` em runtime quebra com não-root | `USER` não vai no Dockerfile; só `user=` no run; `pre_*_command` revisados. |
| `awslogs` mal configurado impede o Docker de subir | Teste em instância descartável; `mode: non-blocking`. |
| Requeue automático cria loop infinito num commit que sempre derruba o worker | `max_attempts` (F5) e status final ERROR. |
| Rate limit (Top 3) ficou fora desta spec? | Não: ver seção 12. |

## 11. Perguntas para o Felipe (respondem antes de F1 e F3)

- Q1. Quais linguagens precisam funcionar na validação? Se for só C/C++ (e talvez Python/Java), F1 e F3 testam só essas e as demais ficam marcadas como não validadas.
- Q2. Há acesso de push ao `ghcr.io/runcodes-icmc`? Se não, F3 exige publicar as imagens em outro registro (GHCR da sua conta ou ECR) e trocar `IMAGE_FORMAT`; isso antecipa parte da onda 2 (fixar por digest).
- Q3. t4g.small fica? Define o teto de memória por container (D1) e se Java entra.
- Q4. Aceita a migration `007` com `attempts` (F5 opção a)?

## 12. F0 (adendo): rate limit no login, signup, reset e upload (Top 3)

Entra nesta onda como fase própria, independente das demais.

**Arquivos:** `api/package.json` (`express-rate-limit`, `rate-limit-redis`), `api/src/app.ts`, novo `api/src/http/middleware/rateLimit.ts`, `auth.routes.ts`, rotas de signup/reset em `users.routes.ts` (**VERIFICAR** nomes), rotas de submissão em `commits.routes.ts`, `auth.service.ts`, `api/src/lib/env.ts`.

**Desenho:**

1. `app.set("trust proxy", N)` onde N é o número de proxies confiáveis entre o cliente e a API: CloudFront + Caddy = 2. **VERIFICAR** se o Caddy reescreve `X-Forwarded-For` (padrão: anexa). Com `trust proxy` errado, o limite por IP é contornável ou pune todo mundo pelo IP do CloudFront.
2. Limites (store Redis via `rate-limit-redis`, prefixo `rl:`): `/api/auth/login` 10/15 min por IP e 5/15 min por e-mail (chave = e-mail normalizado); signup 5/h por IP; reset de senha 3/h por e-mail e 10/h por IP; confirmação de e-mail 10/h por IP; submissão de commit 30/10 min por usuário; `view-as` 20/h por usuário. Resposta 429 `{error:"rate_limited"}` com `Retry-After`. **DECISÃO DO EXECUTOR:** números finais; registrar em `env.ts` com defaults e override por env.
3. `auth.service.ts:39,48`: comparar hash legado com `crypto.timingSafeEqual` sobre buffers de mesmo tamanho.
4. Logar `{"level":"warn","event":"rate_limited","route","key_type"}` para F6 poder criar alarme de abuso depois (não nesta onda).
5. Sem Redis disponível, o middleware falha aberto ou fechado? **Decisão:** fechado para login/reset (503), aberto para o resto, e `/health/deep` já acusa Redis fora.

**Testes:** vitest com store em memória: 11ª tentativa de login dá 429; chave por e-mail independe do IP; `Retry-After` presente; `timingSafeEqual` com hash legado válido e inválido.

**Aceite:** 20 logins errados seguidos contra uma conta real em produção: a partir do 6º, 429; e-mail de alerta não é exigido nesta onda.

**Esforço:** S (1 dia).

---

## 13. Handoff para a próxima sessão (estado em 2026-11-08)

Esta seção existe porque a sessão que escreveu a spec foi arquivada antes das respostas. A próxima sessão começa por aqui.

### 13.1 Pendências do Felipe (bloqueiam fases)

| # | Pergunta | Bloqueia | Resposta |
|---|---|---|---|
| Q1 | Quais linguagens precisam funcionar na validação? Só C/C++, ou também Python/Java? | F1, F3 | _pendente_ |
| Q2 | Há push no `ghcr.io/runcodes-icmc`? Se não, imagens vão para GHCR da conta `felipelageduarte` ou ECR, e `IMAGE_FORMAT` muda. | F3 | _pendente_ |
| Q3 | A t4g.small fica? Define o teto de memória por container e se Java cabe. | F1 | _pendente_ |
| Q4 | Aceita a migration `007` com coluna `attempts` em `commits`? | F5 | _pendente_ |
| Q5 | Merge do PR 18 (esta spec). | tudo | _pendente_ |

### 13.2 Perguntas da revisão que só o dono responde (`docs/reviews/2026-11-07-revisao.md` §6)

Não bloqueiam a onda 1, mas mudam a severidade de itens dela e da onda 2:

- Haverá alunos menores de 18 anos? O que `users.identifier` guarda (matrícula, CPF)? Define a política de privacidade (onda 2, LGPD).
- Os `.in` e as saídas de testes fechados são mostrados ao aluno (`show_user_output`)? Define a gravidade de F2 e F3.
- `/data/exec` está no mesmo volume que o banco e o `data-root` do Docker? Se sim, encher disco derruba o banco (reforça F1 `fsize`).
- Qual o uso real do Redis na API (cache, fila do JPlag)? Define credenciais por serviço na onda 2.
- Volume esperado de submissões por turma e pico de prazo: define se executor separado compensa algum dia.
- Cost Explorer por tag `Project` para confirmar os ~US$ 26/mês; `df -h /data` para avaliar encolher o volume de 40 GB.
- Quantos usuários ainda têm hash SHA-1 (`length(password)=40`): consulta ao banco, leitura, ainda não feita.

### 13.3 Pendências operacionais fora desta spec (já conhecidas, não esquecer)

- **Organização GitHub:** não se cria via `gh` (API só em Enterprise Server). Criar pela web em github.com/account/organizations/new. Depois: `gh api -X POST repos/felipelageduarte/runcodes/transfer -f new_owner=<org>`; o `sub` do OIDC muda para `repo:<org>/runcodes:...` e o trust das roles em `infra/terraform/ci-github.tf` precisa de ajuste **antes** do primeiro deploy pós-transferência; ruleset, secrets e Dependabot vão junto ou se recriam. Vale uma seção em `infra/docs/segregacao.md`.
- **`admin@admin`:** apagado da produção em 2026-11-07, mas o seed do repo `database` recria em todo init novo do volume (e um restore antigo traz de volta). Conferir `SELECT email FROM users` após qualquer recriação. Registrado no `CLAUDE.md`.
- **SMTP:** adiado por decisão do dono; admin cria usuários à mão. Antes de abrir ao público: SMTP real, confirmação de e-mail e reset de senha.
- **Alarme `cpu-credits-low`:** disparou uma vez durante build no host. Se repetir em uso normal, t4g.medium ou build de imagens no CI (onda 2).
- **Restore do SeaweedFS:** nunca ensaiado (`infra/docs/segregacao.md`). Onda 2.
- **web em zod 3** com gate `npm audit` em `critical`: migrar para zod 4 (onda 3).
- **Professor de teste:** o Felipe disse "done" no passo de criar o primeiro professor, mas o banco só tinha os dois admins. Confirmar se a criação pelo painel falhou (possível bug) ou se não foi feita.
- **Perfil do Claude:** lições desta semana ainda não commitadas em `~/.claude/claude-config` (repo do perfil, fora deste repo).

### 13.4 Como retomar

1. Ler esta spec inteira e o §2 (contexto auditado) para não redescobrir.
2. Preencher 13.1 e commitar.
3. Começar por F1 e F2 (independentes das respostas de Q2 e Q4; Q1 e Q3 só definem os números de F1, que têm default conservador).
4. Uma fase por sessão, um PR por fase, merge pelo Felipe.
