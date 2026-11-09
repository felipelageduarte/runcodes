/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origem da API. Default `/api` (mesmo host). Lido só em packages/api-client/src/http.ts. */
  readonly VITE_API_URL?: string;
  /** Base do site de documentação. Default `/docs`. Lido só em src/config.ts. */
  readonly VITE_DOCS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
