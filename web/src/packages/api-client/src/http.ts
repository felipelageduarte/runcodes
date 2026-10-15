const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

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

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    body,
    headers: raw
      ? headers
      : {
          "Content-Type": "application/json",
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
