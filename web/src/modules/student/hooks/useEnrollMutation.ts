import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollByCode, ApiError } from "@runcodes/api-client";
import { toast } from "@runcodes/ui";

const errorMessages: Record<string, string> = {
  invalid_enrollment_code: "Código inválido",
  wrong_university: "Essa turma é de outra instituição",
  already_enrolled: "Você já está matriculado nessa turma",
  banned_from_offering: "Você foi removido dessa turma e não pode entrar de novo",
};

export function useEnrollMutation(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => enrollByCode(code),
    onSuccess: () => {
      toast.success("Você entrou na turma!");
      queryClient.invalidateQueries({ queryKey: ["offerings", "mine"] });
      options?.onSuccess?.();
    },
    onError: (err) => {
      if (!(err instanceof ApiError)) {
        toast.error("Não foi possível entrar na turma");
        return;
      }
      toast.error(errorMessages[err.code ?? ""] ?? "Não foi possível entrar na turma");
    },
  });
}
