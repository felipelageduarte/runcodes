/** Shared helper between the CLI-shelling providers (Dolos, JPlag):
 * extracting a submission's extension to pick the right --language flag. */
export function extensionOf(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}
