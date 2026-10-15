---
title: Segurança no frontend
sidebar_position: 6
---

# Segurança — o que muda com o frontend novo

A autorização de verdade sempre vive no `runcodes-api` (cada service checa papel/matrícula antes de agir — ver [backend overview](../backend/overview.md)). O que segue é especificamente sobre a superfície de ataque que o **cliente** introduz, que é diferente da que o backend já trata.

## Armazenamento do token (JWT) ✅

**Feito na Fase 0.** `POST /api/auth/login` seta um cookie `httpOnly` + `Secure` (produção) + `SameSite=Lax`, além de devolver o token no corpo (mantido só pra scripts/testes que autenticam via `Authorization` — `runcodes-web` nunca lê isso). `GET /api/auth/me` faz a rehydration de sessão no reload (o cookie não é legível por JS, então o nome do usuário precisa de uma ida ao servidor) e `POST /api/auth/logout` limpa o cookie. CORS exige origem explícita + `credentials: true` (`APP_BASE_URL`) em vez do wildcard default, pré-condição pro browser aceitar/enviar o cookie.

`SameSite=Lax`, não `Strict` como planejado originalmente: a classificação de "same-site" do browser ignora porta e subdomínio (só olha o domínio registrável) — `localhost:5173`↔`localhost:3000` em dev e `app.run.codes`↔`api.run.codes` em produção são o mesmo "site", então `Lax` já cobre o caso de uso sem a fricção extra de `Strict` (que bloqueia até navegação cross-site comum).

## XSS via conteúdo gerado por usuário

Dois pontos de risco real, ambos já existentes como *dado* no backend, novos como *superfície renderizada*:

1. **Markdown de exercício** (`exercises.markdown = true`) — o enunciado é escrito por professor, renderizado pro aluno. Markdown vira HTML; HTML sem sanitização é XSS stored. Usar um renderer de markdown que sanitiza por padrão (`react-markdown` com `rehype-sanitize`, não `dangerouslySetInnerHTML` direto) — mesmo um professor "confiável" pode copiar/colar markdown de outro lugar com `<script>` embutido sem querer.
2. **Mensagens de ticket, keywords do marketplace, qualquer texto livre vindo de outro usuário** — nunca renderizado via `dangerouslySetInnerHTML`; React já escapa texto por padrão em JSX (`{texto}`), então o risco só existe se alguém introduzir `dangerouslySetInnerHTML` deliberadamente — regra de lint (`react/no-danger`) bloqueia isso no CI.

## CSP (Content Security Policy)

`runcodes-api` serve a API, não a página — o CSP é configurado no servidor que serve os estáticos do `runcodes-web` (Caddy/nginx, mesmo padrão já usado pro `server` legado). Política mínima recomendada:

```
default-src 'self';
connect-src 'self' <URL do runcodes-api>;
script-src 'self';
style-src 'self' 'unsafe-inline';  # Tailwind compila CSS estático, não precisa disso — quem injeta <style>/style inline em runtime é o próprio Monaco Editor (não dá pra evitar sem alternativa de editor); revisar se algum outro componente também passar a precisar
img-src 'self' data: <URL do S3/SeaweedFS público, se avatares/anexos forem exibidos inline>;
frame-ancestors 'none';
```

Monaco Editor carrega workers via `Worker`/`blob:` — ajustar `worker-src` e `script-src` conforme a configuração de bundling escolhida (Vite tem plugin oficial `vite-plugin-monaco-editor` que resolve isso sem CDN externo, mantendo tudo `'self'`).

## Dependências

- `npm audit` no CI, bloqueando merge em vulnerabilidade `high`/`critical` sem exceção documentada (mesmo padrão de disciplina já usado no `runcodes-api`, onde vulnerabilidades existentes foram auditadas e documentadas como aceitas, não ignoradas silenciosamente).
- Dependabot/Renovate pra manter Radix/React/Vite atualizados — superfície de ataque de supply chain é real num ecossistema com tantas dependências transitivas.

## Upload de arquivo pelo cliente

O editor Monaco e o upload de arquivo convergem no mesmo caminho (ver [code-editor.md](./code-editor.md)) — toda validação de tipo/tamanho de arquivo já existe no backend (`CommitService.submit()` valida extensão permitida e tamanho máximo). O cliente **replica** essa validação só para feedback imediato (não fazer o aluno esperar um upload de 10MB pra descobrir que o tipo não é aceito) — nunca como a fonte de verdade. Um cliente malicioso que pule a validação do frontend ainda bate na validação do servidor.

## Rate limiting e abuso

Fora do escopo do frontend em si (é responsabilidade do `runcodes-api`/proxy), mas o cliente deve tratar `429 Too Many Requests` de forma gratificante (mensagem clara, não um erro genérico) caso o backend venha a implementar rate limiting em endpoints sensíveis (login, resend-confirmation, request-password-reset — hoje sem limite, risco de enumeração/brute-force documentado aqui como gap a considerar no backend, não neste repo).

## "View as" (impersonação) nunca eleva privilégio

A feature de impersonação herdada do legado (ver [journeys.md](./journeys.md#view-as-impersonação--existe-no-legado-não-existe-no-runcodes-api)) só pode **rebaixar** o papel efetivo de quem já está autenticado (professor virando aluno pra testar a própria turma), nunca o contrário — o endpoint que a implementa precisa validar isso no servidor (o papel escopado solicitado é `<=` o papel real do usuário), não confiar em nenhum valor vindo do cliente. Cada ativação/desativação grava no log de auditoria com o papel real e o papel escopado — sem isso, um admin "virando" professor fica indistinguível de um professor de verdade em qualquer auditoria futura.

## Autorização no cliente é UX, nunca segurança

Repetindo o que está em [overview.md](./overview.md#padrões-de-código-e-princípios-de-design) porque é o erro mais fácil de cometer sob pressão de prazo: esconder um botão de "apagar turma" pra quem não é professor é UX. Se o componente que faz a chamada de apagar não checar papel e confiar que "o botão só aparece pra quem pode", qualquer um com DevTools aberto pode chamar a mesma função. A checagem real é sempre, só e exclusivamente no `runcodes-api`.
