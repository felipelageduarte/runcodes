# run.codes

Plataforma de submissão e correção automática de exercícios de programação
— o código do aluno é compilado, executado em sandbox e avaliado contra os
casos de teste do professor, em segundos.

Monorepo com os seis módulos do sistema, cada um com seu histórico git
completo convergido do repositório original:

| Pasta | Linguagem | Responsabilidade |
|---|---|---|
| [`web/`](./web) | React + TypeScript (Vite, Tailwind, Monaco) | Frontend — painel do aluno, professor e admin; editor estilo VS Code com projetos multi-arquivo |
| [`api/`](./api) | Node.js + TypeScript (Express, Prisma) | API HTTP, autenticação, submissões, notas, marketplace, worker de plágio (JPlag/Dolos) |
| [`compiler/`](./compiler) | Python (asyncio, `uv`) | Worker que consome a fila de submissões e as roda em containers por linguagem |
| [`compiler-images/`](./compiler-images) | Docker + Bash | ~23 imagens por linguagem (C, C++, Python, Java, Haskell, Rust, ...) |
| [`compiler-sandbox/`](./compiler-sandbox) | C (CMake) | Binário de sandbox: limites de CPU/memória/arquivo e captura de I/O do processo do aluno |
| [`docs/`](./docs) | Docusaurus | Documentação — manual do usuário (público) e docs de administração (restrito) |

## Rodando em produção (um servidor)

Uma máquina Linux com Docker, um comando:

```bash
cd deploy/compose
cp .env.example .env && $EDITOR .env   # domínio, segredos, SMTP
./bootstrap.sh
```

Detalhes (incluindo AWS com RDS/ElastiCache/S3) em
[`deploy/compose/README.md`](./deploy/compose/README.md).

## Desenvolvimento

Cada módulo tem seu próprio `README`/`CONTRIBUTING` com instruções. Visão
rápida:

```bash
# frontend (localhost:5173, proxy /api -> :3000)
cd web && npm install && npm run dev

# api (localhost:3000)
cd api && npm install && npm run dev

# compiler (worker; precisa de Docker e das imagens de linguagem)
cd compiler && uv sync && uv run python -m rcc

# docs (manual + admin)
cd docs && npm install && npm run start
```

A documentação de arquitetura vive em `docs/admin/` (publicada em
`/docs/admin-docs` quando servida pela API).

## Licença

Veja os arquivos `LICENSE.md` em cada módulo.
