import { randomUUID } from "node:crypto";
import type { NextFunction, Response } from "express";
import type { AuditRepository } from "../../repositories/audit.repository.js";
import type { AuthedRequest } from "./requireAuth.js";

/** Nada a auditar: ping de monitoramento (gravar cada health check vira ruído). */
export const SKIP_PATHS = new Set(["/api/health"]);

/** Rotas cujo corpo nunca vai ao log, nem redigido: gravam só os NOMES dos
 * campos. Login e reset carregam credencial; o console SQL carrega a query
 * (a F5 grava o SQL em campo próprio, antes de executar). */
export const CONTENTLESS_PATHS = new Set([
  "/api/auth/login",
  "/api/users/request-password-reset",
  "/api/users/reset-password",
  "/api/users/confirm",
  "/api/admin/db/query",
]);

/** Chave de corpo que nunca pode ir ao banco em texto claro. Casa por
 * substring e sem distinção de caixa: `confirmPassword`, `newPassword`,
 * `accessToken`, `Authorization`, `senhaAtual` caem todos. */
export const SENSITIVE_KEY = /password|token|secret|authorization|senha/i;

export const MAX_BODY_CHARS = 4000;
const MAX_FIELD_NAMES = 40;
const REQUEST_ID_HEADER = "x-request-id";

export function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

/** Redige e corta: acima de MAX_BODY_CHARS (upload base64, lote grande)
 * guarda tamanho e prefixo em vez do objeto inteiro. */
export function safeBody(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const redacted = redact(value);
  const text = JSON.stringify(redacted);
  if (text === undefined) return null;
  if (text.length <= MAX_BODY_CHARS) return redacted;
  return { truncated: true, size: text.length, preview: text.slice(0, MAX_BODY_CHARS) };
}

/** Agrupa "/offerings/12/members/a@x.com" com "/offerings/34/members/b@y.com"
 * na mesma rota: ids numéricos viram `:id`, segmentos com `@` viram `:email`. */
export function normalizeRoute(path: string): string {
  return path
    .split("/")
    .map((seg) => {
      if (/^\d+$/.test(seg)) return ":id";
      if (seg.includes("@") || seg.includes("%40")) return ":email";
      return seg;
    })
    .join("/");
}

function pathOf(req: AuthedRequest): string {
  const url = req.originalUrl || req.url || "/";
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fieldNames(body: unknown): string[] {
  return isObject(body) ? Object.keys(body).slice(0, MAX_FIELD_NAMES) : [];
}

export function buildRequestBody(req: AuthedRequest, path: string): unknown {
  const query = isObject(req.query) && Object.keys(req.query).length ? redact(req.query) : undefined;
  if (CONTENTLESS_PATHS.has(path)) {
    return { fields: fieldNames(req.body), ...(query ? { query } : {}) };
  }
  if (req.method === "GET" || req.method === "HEAD") {
    return query ? { query } : null;
  }
  const hasBody = req.body !== undefined && req.body !== null && !(isObject(req.body) && !Object.keys(req.body).length);
  if (!hasBody && !query) return null;
  const body = hasBody ? safeBody(req.body) : undefined;
  return { ...(body !== undefined ? { body } : {}), ...(query ? { query } : {}) };
}

/** Garante um id de correlação por requisição: reaproveita `X-Request-Id`
 * do proxy quando vier, senão gera um, e devolve no cabeçalho de resposta
 * (o `errorHandler` 500 pode citar só ele para o usuário). */
export function ensureRequestId(req: AuthedRequest, res: Response): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const fromHeader = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = fromHeader && fromHeader.length <= 128 ? fromHeader : randomUUID();
  res.setHeader("X-Request-Id", id);
  return id;
}

/**
 * Uma linha de `audit_log` por requisição, gravada quando a resposta termina
 * (`finish`), seja qual for o resultado: ação negada (401/403) também é
 * relevante, mais até que a bem-sucedida. Montado uma vez em app.ts, antes
 * dos routers, cobre toda rota automaticamente, inclusive as criadas depois.
 *
 * `req.user` ainda não existe quando o middleware roda (requireAuth é por
 * rota), mas já existe no `finish`, então o ator sai correto sem depender da
 * ordem de montagem. Melhor esforço: nunca lança, nunca derruba a resposta.
 */
export function createAuditLog(audit: AuditRepository) {
  return function auditLog(req: AuthedRequest, res: Response, next: NextFunction) {
    const path = pathOf(req);
    if (SKIP_PATHS.has(path)) return next();

    const startedAt = process.hrtime.bigint();
    const requestId = ensureRequestId(req, res);

    res.on("finish", () => {
      try {
        const user = req.user;
        const viewingAs = user?.realType !== undefined && user.realType !== user.type;
        const rawUa = req.headers["user-agent"];
        audit
          .create({
            actorEmail: user?.email ?? null,
            actorType: user ? (user.realType ?? user.type) : null,
            viewAsType: viewingAs ? user!.type : null,
            method: req.method,
            path,
            route: normalizeRoute(path),
            status: res.statusCode,
            durationMs: Number((process.hrtime.bigint() - startedAt) / 1_000_000n),
            ip: req.ip ?? null,
            userAgent: typeof rawUa === "string" ? rawUa.slice(0, 1000) : null,
            requestId,
            requestBody: buildRequestBody(req, path),
          })
          .catch(() => {}); // auditoria nunca é motivo de falha da requisição
      } catch {
        // idem: erro ao montar a linha não pode vazar para o response
      }
    });

    next();
  };
}
