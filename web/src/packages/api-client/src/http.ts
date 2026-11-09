/** Única leitura de `VITE_API_URL` no app (teste de fronteira em
 * src/test/boundary.test.ts garante isso). Sem a variável o front assume
 * que a API está no mesmo host, em `/api` (proxy do Vite em dev, Caddy em
 * produção). Com ela, aceita origem externa, ex. `https://api.exemplo`. */
export function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL;
  return raw && raw.trim() !== "" ? raw.replace(/\/+$/, "") : "/api";
}

/** Métodos que mudam estado. Toda chamada com um deles leva
 * `X-Requested-With`: a API (fase F2 da spec admin-e-separacao-front)
 * passa a exigir o cabeçalho em mutação como barreira anti-CSRF, porque
 * um formulário HTML cross-site não consegue enviá-lo. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const REQUESTED_WITH_HEADER = "X-Requested-With";
export const REQUESTED_WITH_VALUE = "runcodes-web";

/** Mirrors the shape every error in runcodes-api's domain/errors.ts
 * serializes to — `code` is the discriminable part the UI branches on
 * (e.g. "account_not_confirmed" vs "invalid_credentials"), `error` is a
 * human string kept only as a fallback. See
 * docs/frontend/overview.md#padrões-de-código-e-princípios-de-design. */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiFetchOptions extends RequestInit {
  /** Skip the default `Content-Type: application/json` + JSON body
   * serialization — e.g. multipart uploads build their own FormData. */
  raw?: boolean;
}

/** The only place in the app that calls `fetch` directly — every
 * resource module (auth.ts, exercises.ts, ...) goes through this, never
 * a component. `credentials: 'include'` is required for the browser to
 * send the httpOnly session cookie (see docs/frontend/security.md). */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { raw, headers, body, ...rest } = options;

  const method = (rest.method ?? "GET").toUpperCase();
  const csrfHeaders = MUTATING_METHODS.has(method)
    ? { [REQUESTED_WITH_HEADER]: REQUESTED_WITH_VALUE }
    : undefined;

  const res = await fetch(`${apiBase()}${path}`, {
    ...rest,
    credentials: "include",
    body,
    headers: raw
      ? { ...csrfHeaders, ...headers }
      : {
          "Content-Type": "application/json",
          ...csrfHeaders,
          ...headers,
        },
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message = isJson && typeof payload === "object" ? payload.error : undefined;
    const code = isJson && typeof payload === "object" ? payload.code ?? payload.error : undefined;
    throw new ApiError(res.status, message ?? "request_failed", code);
  }

  return payload as T;
}
