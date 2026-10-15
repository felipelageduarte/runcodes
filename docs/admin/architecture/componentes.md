---
title: Componentes do sistema
sidebar_position: 1.5
---

# Componentes do sistema

Papel e estrutura interna de cada repositório. A [visão geral](./overview.md) mostra como eles se conectam; os [contratos](./contratos.md) listam o que não pode mudar unilateralmente.

## `server` — aplicação web legada (PHP 5.6 / CakePHP 2.4)

Front-end e back-end originais: cadastro, turmas (`offerings`), exercícios, submissões, relatórios. Stack em fim de vida, mantida por compatibilidade enquanto a migração pro `runcodes-api`/`runcodes-web` avança ([estratégia](./migration-strategy.md)). MVC CakePHP clássico, denso: forte acoplamento Controller↔Model — mudar `Model/Commit.php` ou `Model/Exercise.php` repercute em vários controllers. Controllers centrais: `CommitsController` (submissões, download do S3, detalhes por caso), `Exercises*`/`ExerciseCases*`/`AllowedFilesController` (autoria de exercício), `Courses`/`Offerings`/`Enrollments` (hierarquia acadêmica), `Users`/`Universities` (identidade multi-tenant). Roda atrás de um proxy Caddy.

## `runcodes-compiler` — motor de correção (Python 3 / asyncio)

Processo de longa duração, **sem API HTTP**: lê `commits` pendentes do Postgres, processa em containers Docker e grava o resultado de volta no banco e no S3. Pacote raiz `rcc`, entry point `src/main.py`.

```
rcc/
├── config.py              # config via env vars/JSON
├── cmp.py                 # comparadores de saída (texto, tolerante, numérico)
├── languages.py           # linguagem → imagem Docker (is_compilable etc.)
├── engine/
│   ├── poller.py          # loop: busca commits IN_QUEUE → asyncio.Queue
│   ├── consumer.py        # claim atômico + dispatch do pipeline
│   ├── pipeline.py        # prepare → prefetch → container → grade → store
│   ├── container.py       # sobe o container, lê logs em streaming, timeouts
│   ├── grading.py         # compara saídas, calcula nota/status
│   └── workspace.py       # diretório de trabalho, downloads S3, container.config
├── model/                 # Commit, TestCase (espelham as tabelas)
└── provider/
    ├── data/postgres.py   # psycopg_pool assíncrono
    └── storage/s3.py      # boto3 → SeaweedFS
```

O fluxo detalhado (fases, claim, protocolo de sincronização) está em [Pipeline de correção](../operacao/pipeline.md). Requer `/var/run/docker.sock` montado: o engine dispara containers Docker "irmãos" pra cada commit — é um orquestrador local, não um container isolado. A suíte de testes (`pytest`) é extensa e fortemente acoplada a `config.py` e `model/commit.py` — rode a suíte completa depois de tocar nesses dois arquivos.

## `runcodes-compiler-sandbox` — sandbox de recursos (C)

Binário minimalista (`monitor`, CMake) que executa **um único comando** sob limites de recurso e reporta como terminou. Argumentos: `-f` (tamanho máx. de arquivo), `-m` (memória máx.), `-i/-o/-e` (redirecionamento de stdin/stdout/stderr), `-c` (comando). Escreve um arquivo INI-like (seção `[info]` com `time` e `signal`) que o `grading.py` do engine parseia.

:::warning Não é o isolamento de segurança
O próprio README admite: o monitor mede e limita (via `setrlimit`), mas não é sandbox forte (sem seccomp/namespaces próprios). A camada real de isolamento contra abuso é o **container Docker** da imagem de linguagem. O monitor é o medidor de tempo/memória/sinal dentro dele.
:::

É o único artefato nativo empacotado na imagem `base` de `runcodes-compiler-images` (`COPY --from=ghcr.io/runcodes-icmc/runcodes-compiler-sandbox:latest`).

## `runcodes-compiler-images` — imagens Docker por linguagem

Um `Dockerfile` + script shell por linguagem suportada: `c`, `c-omp`, `c-omp-mpi`, `cpp` (e variantes), `dotnet`, `fortran`, `go`, `haskell`, `java`, `julia`, `lua`, `octave`, `pascal`, `portugol`, `prolog`, `python`, `r`, `rust`, `verilog`, `vhdl`, `zig`. Cada pasta publica `ghcr.io/runcodes-icmc/runcodes-compiler-images-<linguagem>`, consumida pelo engine via `languages.py`.

Cadeia de imagens:

```
runcodes-compiler-sandbox (binário C)
        │  COPY --from=... /usr/bin/monitor
        ▼
   base/ (debian slim + monitor + base-script.sh)
        │  FROM runcodes-compiler-images-base
        ▼
 c/, cpp/, java/, python/, rust/, ...
```

- `base-script.sh` define `compile()` e `run_tests()`: lê o `container.config` gerado pelo engine, imprime as mensagens de protocolo (`compilation.start/done`, `run.start/done`) e roda cada caso de teste via `monitor`, gravando `<id>.monitor_out`, `<id>.output` e `<id>.error`.
- `<lang>-script.sh` define só os comandos de compilação/execução da linguagem (ex.: `gcc ${src_file} -o executable -w -O2 -lm`) e é concatenado ao `base-script.sh` dentro da imagem, formando o entrypoint `/usr/bin/runcodes`.
- **Suporte a projetos com `Makefile`**: se existir `src/?akefile`, usa `make all` / `make -s run` em vez do comando padrão da linguagem — é isso que viabiliza submissões multi-arquivo em `.zip`.

Como adicionar uma linguagem nova: ver [Pipeline de correção](../operacao/pipeline.md#adicionando-uma-linguagem).

## `database` — schema PostgreSQL

Fonte única de verdade do schema relacional, compartilhado por `server`, `runcodes-api` e `runcodes-compiler`. Detalhes (tabelas, variantes dev/produção, regra de ouro pra mudanças) em [Banco de dados](../operacao/banco-de-dados.md).

## `deploy` — automação de infraestrutura (Ansible)

Playbooks e roles pra provisionar e atualizar produção: hosts, Docker, Postgres, Redis, SeaweedFS, proxies Caddy e as duas aplicações. Detalhes em [Deploy](../operacao/deploy.md).

## `runcodes-api` e `runcodes-web`

Os módulos novos têm documentação de design própria: [backend](../backend/overview.md) (Express + Prisma, arquitetura em camadas, módulos, testes) e [frontend](../frontend/overview.md) (React + Vite + Tailwind, SPA modular, Monaco, design system).
