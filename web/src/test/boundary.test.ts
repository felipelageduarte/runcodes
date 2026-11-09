import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

/** Fronteira do front (spec docs/specs/admin-e-separacao-front.md, A6):
 * `web/` precisa buildar e testar sozinho, sem ler nada fora da própria
 * pasta, pra extração por `git subtree split --prefix=web` sair limpa.
 * Este teste falha se alguém importar `../api/...`, `../../docs/...` ou
 * qualquer caminho que resolva fora de `web/`, e se `import.meta.env`
 * voltar a se espalhar além dos dois pontos de configuração. */

const WEB_ROOT = resolve(__dirname, "../..");
const SCAN_ROOTS = ["src", "e2e"];
const CONFIG_FILES = [
  "vite.config.ts",
  "vitest.config.ts",
  "playwright.config.ts",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "index.html",
];
const SOURCE_EXT = /\.(tsx?|mts|cts|jsx?|mjs|cjs|css)$/;
/** Únicos arquivos autorizados a ler `import.meta.env`. */
const ENV_READERS = new Set(["src/packages/api-client/src/http.ts", "src/config.ts"]);
/** Únicos arquivos onde `VITE_API_URL` pode aparecer (leitura e tipagem). */
const API_URL_MENTIONS = new Set(["src/packages/api-client/src/http.ts", "src/vite-env.d.ts"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

const IMPORT_RE =
  /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)|@import\s+['"]([^'"]+)['"]/g;

function specifiersOf(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(IMPORT_RE)) out.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  return out;
}

function isInsideWeb(file: string, specifier: string): boolean {
  const target = resolve(dirname(file), specifier.split("?")[0]);
  const rel = relative(WEB_ROOT, target);
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith(sep);
}

const sourceFiles = SCAN_ROOTS.flatMap((root) => walk(join(WEB_ROOT, root)));
const relPath = (file: string) => relative(WEB_ROOT, file).split(sep).join("/");

describe("fronteira do web/", () => {
  it("encontra os arquivos-fonte", () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  it("nenhum import relativo resolve fora de web/", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      for (const spec of specifiersOf(source)) {
        if (!spec.startsWith(".")) continue;
        if (!isInsideWeb(file, spec)) offenders.push(`${relPath(file)} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("nenhum arquivo de configuração aponta para fora de web/", () => {
    const offenders: string[] = [];
    for (const name of CONFIG_FILES) {
      const file = join(WEB_ROOT, name);
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(/['"](\.\.\/[^'"]*)['"]/g)) {
        if (!isInsideWeb(file, m[1])) offenders.push(`${name} -> ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("import.meta.env só é lido em http.ts e config.ts", () => {
    const offenders = sourceFiles
      .filter((file) => !ENV_READERS.has(relPath(file)) && !relPath(file).endsWith(".test.ts"))
      .filter((file) => /import\.meta\.env/.test(readFileSync(file, "utf8")))
      .map(relPath);
    expect(offenders).toEqual([]);
  });

  it("VITE_API_URL não aparece fora de http.ts (e da tipagem)", () => {
    const offenders = sourceFiles
      .filter((file) => !API_URL_MENTIONS.has(relPath(file)) && !relPath(file).endsWith(".test.ts"))
      .filter((file) => readFileSync(file, "utf8").includes("VITE_API_URL"))
      .map(relPath);
    expect(offenders).toEqual([]);
  });

  it("nenhuma navegação interna por window.location.href", () => {
    const offenders = sourceFiles
      .filter((file) => !relPath(file).endsWith(".test.ts"))
      .filter((file) => /window\.location\.href\s*=/.test(readFileSync(file, "utf8")))
      .map(relPath);
    expect(offenders).toEqual([]);
  });
});
