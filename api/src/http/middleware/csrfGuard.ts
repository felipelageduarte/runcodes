import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE_NAME } from "./requireAuth.js";

export const CSRF_HEADER = "x-requested-with";
export const CSRF_HEADER_VALUE = "runcodes-web";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface CsrfGuardOptions {
  /** Origens (scheme://host[:port]) que podem fazer mutação com cookie. */
  allowedOrigins: string[];
  /** Exigir `X-Requested-With: runcodes-web` além da checagem de Origin.
   * `false` só na transição até o front (F0) mandar o cabeçalho. */
  requireHeader: boolean;
}

/** Normaliza APP_BASE_URL + lista extra em origens comparáveis. */
export function allowedOriginsFrom(appBaseUrl: string, extra = ""): string[] {
  const all = [appBaseUrl, ...extra.split(",")].map((s) => s.trim()).filter(Boolean);
  const origins = new Set<string>();
  for (const raw of all) {
    try {
      origins.add(new URL(raw).origin);
    } catch {
      throw new Error(`invalid origin in APP_BASE_URL/APP_ALLOWED_ORIGINS: "${raw}"`);
    }
  }
  return [...origins];
}

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** Anti-CSRF do lado da API (spec admin-e-separacao-front, A5). Só vale
 * para mutações autenticadas pelo cookie de sessão: é o cookie que o
 * browser manda sozinho num request forjado. Bearer sem cookie segue como
 * antes (scripts, testes, clientes de API).
 *
 * Duas checagens: `Origin` (ou `Referer`, quando o browser omite Origin)
 * precisa estar na lista de origens aceitas, e o request precisa trazer
 * `X-Requested-With: runcodes-web`, que um formulário cross-site não
 * consegue adicionar. */
export function createCsrfGuard(options: CsrfGuardOptions) {
  const allowed = new Set(options.allowedOrigins);
  return function csrfGuard(req: Request, res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method)) return next();
    if (!req.cookies?.[SESSION_COOKIE_NAME]) return next();

    const origin = originOf(req.headers.origin) ?? originOf(req.headers.referer);
    if (!origin) return res.status(403).json({ error: "csrf_origin_missing" });
    if (!allowed.has(origin)) return res.status(403).json({ error: "csrf_origin_mismatch" });

    const header = req.headers[CSRF_HEADER];
    if (header !== CSRF_HEADER_VALUE && options.requireHeader) {
      return res.status(403).json({ error: "csrf_header_missing" });
    }
    next();
  };
}
