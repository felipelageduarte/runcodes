import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  UserType,
  CommitStatus,
  COMPILABLE_EXERCISE_TYPES,
  NOT_COMPILABLE_EXERCISE_TYPE,
} from "@runcodes/shared";

/** Contrato de constantes duplicadas (spec admin-e-separacao-front, A3,
 * decisão Q1: sem OpenAPI por ora). `web/src/packages/shared` espelha
 * `api/src/lib/constants.ts` à mão; este teste lê o arquivo da API por
 * regex (sem importar código da API, pra não acoplar os pacotes) e falha
 * se os valores divergirem. Enquanto `web/` vive no monorepo o arquivo
 * existe e o teste roda; depois da extração ele não existe e o teste é
 * pulado — aí o contrato passa a ser verificado no repo da API (ou por
 * OpenAPI, quando entrar). */

const API_CONSTANTS = resolve(__dirname, "../../../api/src/lib/constants.ts");
const hasApi = existsSync(API_CONSTANTS);

function parseObject(source: string, name: string): Record<string, number> {
  const m = source.match(new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\} as const;`));
  if (!m) throw new Error(`${name} não encontrado em ${API_CONSTANTS}`);
  const out: Record<string, number> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^\s*([A-Z_]+):\s*(\d+)\s*,?/);
    if (kv) out[kv[1]] = Number(kv[2]);
  }
  return out;
}

function parseNumberArray(source: string, name: string): number[] {
  const m = source.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\];`));
  if (!m) throw new Error(`${name} não encontrado em ${API_CONSTANTS}`);
  return m[1].split(",").map((s) => Number(s.trim()));
}

function parseNumber(source: string, name: string): number {
  const m = source.match(new RegExp(`export const ${name} = (\\d+);`));
  if (!m) throw new Error(`${name} não encontrado em ${API_CONSTANTS}`);
  return Number(m[1]);
}

describe.skipIf(!hasApi)("contrato web/shared x api/src/lib/constants.ts", () => {
  const source = hasApi ? readFileSync(API_CONSTANTS, "utf8") : "";

  it("UserType tem as mesmas chaves e valores", () => {
    expect({ ...UserType }).toEqual(parseObject(source, "UserType"));
  });

  it("CommitStatus tem as mesmas chaves e valores", () => {
    expect({ ...CommitStatus }).toEqual(parseObject(source, "CommitStatus"));
  });

  it("tipos de exercício compiláveis batem", () => {
    expect(COMPILABLE_EXERCISE_TYPES).toEqual(parseNumberArray(source, "CompilableExerciseTypes"));
    expect(NOT_COMPILABLE_EXERCISE_TYPE).toBe(parseNumber(source, "NotCompilableExerciseType"));
  });
});
