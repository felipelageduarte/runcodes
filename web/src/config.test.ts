import { describe, it, expect, afterEach, vi } from "vitest";
import { docsUrl } from "./config";

describe("docsUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("usa /docs por padrão", () => {
    vi.stubEnv("VITE_DOCS_URL", "");
    expect(docsUrl()).toBe("/docs");
    expect(docsUrl("/manual/intro/")).toBe("/docs/manual/intro/");
  });

  it("aceita host externo com ou sem barra final", () => {
    vi.stubEnv("VITE_DOCS_URL", "https://docs.exemplo/");
    expect(docsUrl("admin-docs/")).toBe("https://docs.exemplo/admin-docs/");
  });
});
