import { describe, it, expect, beforeAll } from "vitest";
import type { Express, RequestHandler } from "express";
import { ADMIN_PERMISSIONS, type AdminPermission } from "./admin-permissions.js";
import { permissionOf } from "./middleware/requirePermission.js";

/**
 * Teste estrutural (padrão botimovel `rbac-catalog.test`): varre o app
 * montado de verdade e falha se uma rota administrativa for adicionada sem
 * `requirePermission(chave)`. É o que impede a "rota admin esquecida"
 * (achado crítico do emboabaDuarte) de chegar à produção.
 */

/** Prefixos cujas rotas são todas administrativas. */
const ADMIN_PREFIXES = ["/api/admin", "/docs/admin-docs"];

/** Chaves do catálogo reservadas para fases que ainda não montaram rota
 * (F1 auditoria, F4 painel). Tirar daqui quando a rota existir. */
const RESERVED_FOR_LATER_PHASES: AdminPermission[] = ["admin.audit:read", "admin.overview:read"];

interface MountedRoute {
  method: string;
  path: string;
  permission?: AdminPermission;
}

interface Layer {
  name: string;
  regexp: RegExp & { fast_slash?: boolean };
  keys: { name: string }[];
  handle: RequestHandler & { stack?: Layer[] };
  route?: { path: string; methods: Record<string, boolean>; stack: Layer[] };
}

/** Reconstrói o path de um layer do Express 4 a partir do regexp que o
 * path-to-regexp 0.1 gera (`^\/api\/x\/(?:([^\/]+?))\/?(?=\/|$)`). */
function pathOf(layer: Layer): string {
  if (layer.regexp.fast_slash) return "";
  let src = layer.regexp.source;
  src = src.replace(/^\^/, "").replace(/\\\/\?\(\?=\\\/\|\$\)$/, "");
  for (const key of layer.keys) src = src.replace("(?:([^\\/]+?))", `:${key.name}`);
  return src.replace(/\\\//g, "/");
}

function firstPermission(handlers: unknown[]): AdminPermission | undefined {
  for (const h of handlers) {
    const p = permissionOf(h);
    if (p) return p;
  }
  return undefined;
}

function walk(stack: Layer[], prefix: string, inherited: unknown[], out: MountedRoute[]) {
  let guards = inherited;
  for (const layer of stack) {
    if (layer.route) {
      const handlers = [...guards, ...layer.route.stack.map((l) => l.handle)];
      for (const method of Object.keys(layer.route.methods)) {
        out.push({
          method: method.toUpperCase(),
          path: prefix + layer.route.path,
          permission: firstPermission(handlers),
        });
      }
    } else if (layer.handle.stack) {
      walk(layer.handle.stack, prefix + pathOf(layer), guards, out);
    } else if (layer.regexp.fast_slash) {
      // router.use(fn): vale para toda rota montada depois neste router.
      guards = [...guards, layer.handle];
    } else {
      // router.use("/sub", fn): guarda de prefixo (ex.: /docs/admin-docs).
      out.push({ method: "USE", path: prefix + pathOf(layer), permission: firstPermission([...guards, layer.handle]) });
    }
  }
}

function normalize(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function listMountedRoutes(app: Express): MountedRoute[] {
  const raw: MountedRoute[] = [];
  const stack = (app as unknown as { _router: { stack: Layer[] } })._router.stack;
  walk(stack, "", [], raw);
  // `router.use("/x", a, b)` vira um layer por handler com o mesmo path:
  // junta por (método, path), ficando com a permissão se algum tiver.
  const merged = new Map<string, MountedRoute>();
  for (const r of raw) {
    const path = normalize(r.path);
    const key = `${r.method} ${path}`;
    const prev = merged.get(key);
    merged.set(key, { method: r.method, path, permission: prev?.permission ?? r.permission });
  }
  return [...merged.values()];
}

/** Container mínimo: o app só precisa dos services na hora de atender
 * request, e aqui ninguém atende request. */
function stubContainer() {
  const passthrough: RequestHandler = (_req, _res, next) => next();
  const services = new Proxy({}, { get: () => ({}) });
  return {
    services,
    middleware: { requireAuth: passthrough, auditLog: passthrough, csrfGuard: passthrough },
    allowedOrigins: ["http://localhost:5173"],
  };
}

let routes: MountedRoute[];

beforeAll(async () => {
  // lib/env.ts valida process.env no import; o app só usa DOCS_DIST_DIR.
  const required = {
    DATABASE_URL: "postgres://test",
    JWT_SECRET: "test",
    LEGACY_PASSWORD_SALT: "test",
    S3_ENDPOINT: "http://localhost:9000",
    S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test",
  };
  for (const [k, v] of Object.entries(required)) process.env[k] ??= v;
  const { buildApp } = await import("../app.js");
  const app = buildApp(stubContainer() as unknown as Parameters<typeof buildApp>[0]);
  routes = listMountedRoutes(app);
});

describe("catálogo de permissões admin", () => {
  it("monta um número plausível de rotas (o walker não quebrou com o Express)", () => {
    expect(routes.length).toBeGreaterThan(50);
    expect(routes.some((r) => r.path === "/api/admin/users" && r.method === "GET")).toBe(true);
  });

  it("toda rota sob /api/admin* e /docs/admin-docs exige uma permissão do catálogo", () => {
    const adminRoutes = routes.filter((r) => ADMIN_PREFIXES.some((p) => r.path.startsWith(p)));
    expect(adminRoutes.length).toBeGreaterThan(0);
    const unprotected = adminRoutes.filter((r) => !r.permission).map((r) => `${r.method} ${r.path}`);
    expect(unprotected, "rota admin sem requirePermission(...)").toEqual([]);
  });

  it("toda permissão usada existe no catálogo", () => {
    const used = new Set(routes.map((r) => r.permission).filter(Boolean) as AdminPermission[]);
    for (const p of used) expect(p in ADMIN_PERMISSIONS, `permissão fora do catálogo: ${p}`).toBe(true);
  });

  it("toda chave do catálogo protege ao menos uma rota (ou está reservada para fase futura)", () => {
    const used = new Set(routes.map((r) => r.permission).filter(Boolean));
    const unused = (Object.keys(ADMIN_PERMISSIONS) as AdminPermission[]).filter(
      (k) => !used.has(k) && !RESERVED_FOR_LATER_PHASES.includes(k),
    );
    expect(unused, "chave do catálogo sem rota").toEqual([]);
    const reservedButUsed = RESERVED_FOR_LATER_PHASES.filter((k) => used.has(k));
    expect(reservedButUsed, "tirar de RESERVED_FOR_LATER_PHASES").toEqual([]);
  });

  it("as rotas que eram requireMinType(ADMIN) continuam fechadas", () => {
    const expected: Record<string, AdminPermission> = {
      "POST /api/universities": "admin.universities:manage",
      "PUT /api/universities/:id": "admin.universities:manage",
      "GET /api/courses": "admin.courses:manage",
      "POST /api/courses": "admin.courses:manage",
      "GET /api/courses/:id": "admin.courses:manage",
      "GET /api/courses/search/mine": "courses:search",
      "POST /api/offerings": "offerings:create",
      "GET /api/exercises": "admin.exercises:read",
      "POST /api/allowed-files": "admin.allowed-files:manage",
      "PUT /api/allowed-files/:id": "admin.allowed-files:manage",
      "POST /api/questions": "admin.questions:manage",
      "PUT /api/questions/:id": "admin.questions:manage",
      "DELETE /api/questions/:id": "admin.questions:manage",
      "POST /api/messages": "admin.messages:manage",
      "GET /api/messages": "admin.messages:manage",
      "GET /api/admin/logs": "admin.logs:read",
      "GET /api/admin/logs/stats": "admin.logs:read",
      "GET /api/admin/stats/activity": "admin.stats:read",
      "USE /docs/admin-docs": "admin.docs:read",
    };
    const byKey = new Map(routes.map((r) => [`${r.method} ${r.path}`, r.permission]));
    for (const [key, permission] of Object.entries(expected)) {
      expect(byKey.get(key), key).toBe(permission);
    }
  });
});
