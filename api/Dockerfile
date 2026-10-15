# Multi-stage: `api` roda o servidor HTTP, `worker` (herda de api) adiciona
# a JRE e o jar do JPlag pro worker de plágio (dist/worker.js). O deploy
# por compose escolhe o alvo com `target: api` / `target: worker`.
FROM node:24-slim AS build
# openssl presente no build: o prisma generate detecta a plataforma
# (debian-openssl-3.0.x) e embute o engine certo pro runtime igual.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:24-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
# node_modules inteiro (sem prune): o client gerado do Prisma vive em
# node_modules/.prisma e um prune agressivo o descartaria.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]

FROM api AS worker
# JPlag roda numa JVM; o jar é baixado por `npm run fetch:jplag` antes do
# build da imagem (ver deploy/compose/bootstrap.sh) e entra via vendor/.
RUN apt-get update && apt-get install -y --no-install-recommends default-jre-headless && rm -rf /var/lib/apt/lists/*
COPY vendor ./vendor
CMD ["node", "dist/worker.js"]
