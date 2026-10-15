import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export interface ProjectFile {
  /** Caminho dentro do zip — pode ter "/" (ex. "src/main.c"), sem "/"
   * inicial. É a chave de identidade do arquivo na UI (não há id
   * separado). */
  name: string;
  content: string;
}

/** Projeto multi-arquivo → .zip, pro mesmo endpoint de submissão de
 * sempre (ver docs/frontend/code-editor.md) — o runcodes-compiler já
 * sabe extrair um .zip com Makefile e compilar (ver
 * src/rcc/engine/workspace.py no runcodes-compiler), isso aqui só monta
 * os bytes. */
export function zipProject(files: ProjectFile[]): Uint8Array<ArrayBuffer> {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[file.name] = strToU8(file.content);
  }
  const zipped = zipSync(entries, { level: 6 });
  // fflate's output can be a view over a buffer TS won't type as plain
  // ArrayBuffer (needed for the File constructor) — copy into one we
  // control instead of fighting the typed-array generics.
  const copy = new Uint8Array(new ArrayBuffer(zipped.byteLength));
  copy.set(zipped);
  return copy;
}

export function unzipProject(bytes: Uint8Array): ProjectFile[] {
  const entries = unzipSync(bytes);
  return Object.entries(entries)
    .filter(([name]) => !name.endsWith("/"))
    .map(([name, data]) => ({ name, content: strFromU8(data) }));
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
