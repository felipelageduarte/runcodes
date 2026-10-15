import { normalizeExtension } from "@runcodes/shared";
import type { AllowedFile } from "@runcodes/api-client";

// Texto fixo por linguagem, preservado do legado (javaAgreement/
// makeAgreement em ExercisesController::view()) — conteúdo, não lógica.
// Ver docs/frontend/journeys.md#jornada-do-aluno.
const AGREEMENTS: Record<string, string> = {
  java: "Seu código Java será compilado e executado em um ambiente isolado. Evite usar bibliotecas externas não padrão — elas não estarão disponíveis no ambiente de correção.",
  mk: "O Makefile enviado deve ter um alvo padrão que compile o programa sem argumentos adicionais — o ambiente de correção executa apenas `make`.",
  makefile: "O Makefile enviado deve ter um alvo padrão que compile o programa sem argumentos adicionais — o ambiente de correção executa apenas `make`.",
};

export function LanguageAgreements({ allowedFiles }: { allowedFiles: AllowedFile[] }) {
  const extensions = [...new Set(allowedFiles.map((f) => normalizeExtension(f.extension)))];
  const notices = extensions.map((ext) => AGREEMENTS[ext]).filter((n): n is string => Boolean(n));

  if (notices.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {notices.map((notice, i) => (
        <p key={i} className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          {notice}
        </p>
      ))}
    </div>
  );
}
