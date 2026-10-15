# Modernização e auditoria — outubro/2026

Branch de trabalho: `feat/p1-p2-sandbox-hardening` (working tree estava limpo antes das mudanças).
Baseline de testes antes de qualquer mudança: 88 testes unitários, todos passando.
Status final: **95 testes passando** (88 originais + 7 novos), `ruff check` e `ruff format` limpos, `basedpyright` com 0 erros (40 warnings pré-existentes em testes).

Os testes rodam assim (não há pytest no projeto; a suite é unittest puro e o diretório
`src/rcc/tests` não tem `__init__.py`, então o discovery automático não funciona):

```sh
cd src && PYTHONPATH=. ../.venv/bin/python -m unittest \
  rcc.tests.test_cmp rcc.tests.test_config rcc.tests.test_container_hardening \
  rcc.tests.test_grading rcc.tests.test_parallelism rcc.tests.test_postgres_provider \
  rcc.tests.test_prefetch rcc.tests.test_workspace
```

## 1. Versões

### Python
- `requires-python = ">=3.14"`, Dockerfiles em `python:3.14-alpine`, venv em CPython 3.14.3. **Mantido.**
  3.14 é a versão estável mais nova que o toolchain e as dependências suportam: o uv local só
  conhece 3.15 em alpha (3.15.0a6) e `psycopg[binary]` ainda não publica wheels cp315 no lock.
  Reavaliar 3.15 em alguns meses.

### Dependências (`uv lock --upgrade`, antes → depois)
| Pacote | Antes | Depois |
|---|---|---|
| boto3 | 1.43.108 | 1.43.114 |
| boto3-stubs | 1.43.91 | 1.43.114 |
| botocore | 1.43.109 | 1.43.114 |
| botocore-stubs | 1.43.67 | 1.43.114 |
| charset-normalizer | 3.5.1 | 3.5.2 |
| idna | 3.19 | 3.20 |
| mypy-boto3-s3 | 1.43.90 | 1.43.106 |
| psycopg / psycopg-binary | 3.3.5 | 3.3.6 |
| ruff | 0.16.10 | 0.17.0 |
| types-s3transfer | 0.16.0 | 0.19.2 |
| tzdata | 2026.3 | 2026.5 |
| urllib3 | 2.7.0 | 2.8.0 |

`docker` (7.2.0) e `psycopg-pool` (3.3.1) já estavam na última versão dos seus ranges.
Nenhuma deprecation nova apareceu nos testes após o upgrade.

## 2. Bugs corrigidos

### 2.1 "Database connection pool is not open; call open() first" (o erro do log)
`src/rcc/provider/data/postgres.py:121` / `src/rcc/engine/poller.py:67`.
Não era uma race intermitente: era **determinístico em todo start/restart**. O `main()` criava a
task do consumer (que abria o pool) e em seguida entrava direto no loop do poller; o primeiro
`fetch_commits_in_queue()` rodava **antes** de a task do consumer ser sequer agendada pelo event
loop, então todo startup logava esse traceback e perdia um ciclo de poll.

Correção (`src/rcc/__init__.py`, `src/rcc/engine/consumer.py`): o ciclo de vida do pool agora é
do `main()` (composition root): `await data_provider.open()` antes de criar consumer e poller, e
`close()` no `finally`. O consumer não abre nem fecha mais o pool. O comportamento lazy foi
preservado (pool abre com `wait=False`; banco fora do ar não derruba o processo).

### 2.2 Processo zumbi quando o consumer morre
Se o consumer parava por erro não-retryable (`MemoryError`, `OSError`, ...), o poller continuava
rodando para sempre: logava erro a cada ciclo e, com a fila cheia, travava num `put()` eterno sem
ninguém consumindo. Agora o poller roda como task própria e o `main()` faz
`asyncio.wait(..., FIRST_COMPLETED)` sobre consumer+poller: se o consumer parar, o poller é
cancelado, os commits in-flight são drenados e o processo sai (o supervisor reinicia).

### 2.3 Vazamento de containers Docker
`src/rcc/engine/container.py`: se `_run_compilation`/`_run_execution` levantassem exceção
(ex.: timeout de compilação — caso comum com código de aluno), `_teardown_container` nunca
rodava: o container ficava **rodando e nunca era removido** (um container vazado por commit que
estourasse timeout). O teardown agora roda num `finally` e nunca levanta exceção própria
(`wait`/`kill` protegidos; `remove(force=True)` roda sempre), para não mascarar o erro original.

### 2.4 Injeção de shell via nome de arquivo no container.config
`src/rcc/engine/workspace.py` (`create_container_cfg_file`): o `container.config` é feito com
`src_file='<fname>'` e é *sourced* pelo `base-script.sh` dentro do container. O nome do arquivo é
controlado pelo aluno; um nome com aspas simples (`a'$(cmd)'.c`) escapava do quoting e injetava
shell no startup do container. Severidade moderada (o código do aluno já executa nesse container
sandboxed), mas a injeção acontecia *antes* das restrições do script. Aspas simples embutidas
agora são escapadas (`'\''`). Teste novo: `test_src_file_single_quotes_are_escaped`.

### 2.5 Zip bomb / path traversal em submissões .zip
`src/rcc/engine/workspace.py`: `extractall()` rodava sem nenhum limite. No Python moderno o
`zipfile` já sanitiza nomes com `..`/absolutos (realoca silenciosamente, não escreve fora do
`src_dir`, e não cria symlinks), então traversal real não era explorável — mas **zip bomb era**:
um zip pequeno podia expandir para dezenas de GB e esgotar o disco do worker.
Novo `check_zip_safety()` roda antes do `extractall`:
- rejeita nomes absolutos ou com componente `..` (falha visível em vez de realocação silenciosa);
- limite de membros (default 4096, config `max_zip_members`);
- limite de tamanho total descomprimido declarado (default 256 MiB, config
  `max_zip_uncompressed_size`).
Um zip rejeitado falha só aquele commit (INTERNAL_ERROR), não o worker. 6 testes novos.

## 3. Código morto removido
- `rcc.util.from_datetime_to_timestamp` (sem uso em código ou testes).
- `rcc.util.Sleeper.sleep()` (bloqueante; o código async usa só `sleep_time()`).
- Bloco `if __name__ == "__main__"` em `src/rcc/__init__.py` (inexecutável por causa dos imports
  relativos; o entrypoint real é `src/main.py`, usado pelos Dockerfiles).

## 4. Auditoria — resto do checklist
- **SQL injection**: nenhum. Todas as queries de `postgres.py` são parametrizadas (`%s` + tupla).
- **Erro em commit derruba o worker?** Não. `_claim_and_run` isola cada commit: exceções
  retryable devolvem o commit para a fila (`release_commit`); só exceções não-retryable
  (`MemoryError`, `OSError`, `SystemExit`, `SystemError`) param o consumer — e agora isso encerra
  o processo em vez de deixá-lo zumbi (item 2.2).
- **Locks/semáforos**: corretos. Semáforo adquirido antes do `create_task` e liberado no
  `finally` da task (sem vazamento de slot); fila bounded dá backpressure; claim atômico via
  UPDATE condicional resolve duplicatas do poller.
- **Vazamento de tasks**: `in_flight` é drenado no shutdown; `download_task` do prefetch tem
  `done_callback` para nunca gerar "exception was never retrieved". OK.

## 5. Achados reportados (sem correção)
1. **`fetch_test_case_files` (s3.py)**: `os.path.join(destination, fname)` com `fname` vindo do
   banco (`exercise_case_files.path`, controlado pelo professor). Um path com `../` escreve fora
   do diretório do teste. Risco baixo (dado de instrutor, não de aluno); sugerido validar ou usar
   `os.path.basename`.
2. **`DEFAULT_MKDIR_PERMISSIONS = 0o777`** (`engine/common.py`): permissivo demais; provavelmente
   necessário pelo bind mount + usuário do container, mas vale revisar com umask/chown explícito.
3. **`grading.process_test_results`**: `os.stat(user_err_fname)` fica fora do try que tolera
   monitor quebrado; um `.error` ausente aborta o batch inteiro de test cases (vira INTERNAL_ERROR
   do commit). Mesma classe do fix recente de `monitor_out`; fácil de incluir no mesmo tratamento.
4. **Senha default do banco** em `config.py` (`asdasd33`) — default de dev; ok se produção sempre
   define env var, mas um default vazio + erro explícito seria mais seguro.
5. **Suite não é descobrível**: falta `__init__.py` em `src/rcc/tests` (e não há pytest). Adicionar
   pytest como dev-dependency (ou o `__init__.py`) tornaria `uv run pytest` / discovery possível.
   Não fiz para não mudar a filosofia zero-dep dos testes sem combinar.
6. **Testes de integração** (`src/rcc/tests/engine/test_process_commit_*`) exigem imagens docker
   por linguagem e `/var/runcodes/runs`; não rodaram nem no baseline nem depois (ambiente local
   sem `/var/runcodes`). As mudanças nessa área estão cobertas pelos testes unitários novos.
7. **Arquitetura** (só observação): `compiled_message`/`compiled_error` são gravados em base64
   (contrato legado com a app web); constantes de status do `Commit` têm numeração histórica
   não-contígua. Nada a fazer sem coordenar com o resto da plataforma.

## 6. Arquivos alterados
- `uv.lock` — upgrade de dependências.
- `src/rcc/__init__.py` — pool aberto/fechado pelo main; poller como task; shutdown quando o
  consumer morre; remoção de bloco `__main__` morto.
- `src/rcc/engine/consumer.py` — não gerencia mais o pool.
- `src/rcc/engine/container.py` — teardown do container em `finally`, à prova de exceção.
- `src/rcc/engine/workspace.py` — `check_zip_safety` + escaping de aspas no container.config.
- `src/rcc/util.py` — código morto removido.
- `src/rcc/tests/test_workspace.py` — 7 testes novos (zip safety + quoting).
- `src/rcc/tests/test_parallelism.py` — ajustado à nova posse do pool (asserções de
  open/close movidas para o teste do `main()`).
