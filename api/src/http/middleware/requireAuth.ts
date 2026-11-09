import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Requester } from "../../services/offering.service.js";
import type { SessionStateSource } from "../../lib/session-state.js";

export const SESSION_COOKIE_NAME = "token";

export interface AuthedRequest extends Request {
  user?: Requester;
}

/** Claims que a API assina (ver AuthService). `tv` é a token_version do
 * usuário no momento da emissão: muda ao trocar senha, tipo ou confirmação
 * e derruba todo token anterior. Token sem `tv` (emitido antes da F2) vale
 * como `tv = 0`, que é o default da coluna: continua válido até a primeira
 * revogação, sem obrigar todo mundo a logar de novo no deploy. */
export interface SessionTokenPayload {
  sub: string;
  type: number;
  realType?: number;
  tv?: number;
}

export function tokenVersionOf(payload: Pick<SessionTokenPayload, "tv">): number {
  return typeof payload.tv === "number" ? payload.tv : 0;
}

export function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  return req.cookies?.[SESSION_COOKIE_NAME] ?? headerToken;
}

/** Factory, not a singleton import — the JWT secret flows in from the
 * composition root instead of each file reading process.env itself.
 *
 * Accepts the token from either the httpOnly session cookie (set by
 * POST /api/auth/login — what runcodes-web uses) or the Authorization
 * header (what API clients/scripts/the integration test suite use) —
 * cookie takes precedence when both are present.
 *
 * O token só prova identidade; papel e estado da conta vêm do banco
 * (`sessions`, cache de 60 s invalidado nas escritas): rebaixar um admin,
 * desconfirmar ou trocar a senha vale para a sessão corrente, não só para
 * o próximo login. */
export function createRequireAuth(jwtSecret: string, sessions: SessionStateSource) {
  return async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "missing_token" });

    let payload: SessionTokenPayload;
    try {
      payload = jwt.verify(token, jwtSecret) as SessionTokenPayload;
    } catch (err) {
      const expired = err instanceof jwt.TokenExpiredError;
      return res.status(401).json({ error: expired ? "token_expired" : "invalid_token" });
    }

    try {
      const state = await sessions.findSessionState(payload.sub);
      if (!state) return res.status(401).json({ error: "invalid_token" });
      if (state.tokenVersion !== tokenVersionOf(payload)) {
        return res.status(401).json({ error: "session_revoked" });
      }
      if (!state.confirmed) return res.status(401).json({ error: "account_not_confirmed" });

      // view-as: o papel efetivo é o pedido no token, limitado pelo papel
      // REAL atual. Se a conta foi rebaixada abaixo do papel "visto como",
      // o view-as deixa de existir e a sessão vira o papel real.
      if (payload.realType !== undefined && payload.type < state.type) {
        req.user = { email: payload.sub, type: payload.type, realType: state.type };
      } else {
        req.user = { email: payload.sub, type: state.type };
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
