import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button, EmptyState, FormField, Input, toast } from "@runcodes/ui";
import { ApiError } from "@runcodes/api-client";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "./AuthLayout";

const schema = z.object({ email: z.string().min(1, "Informe seu email") });
type FormValues = z.infer<typeof schema>;

/** "Reenviar confirmação" e "esqueci minha senha" têm a mesma forma: um
 * email, um endpoint, uma tela de "enviado". runcodes-api devolve 404
 * pra email desconhecido nos dois (não esconde existência de conta) —
 * mostrado como erro real, não como sucesso silencioso. */
export function EmailOnlyForm({
  title,
  description,
  sentTitle,
  sentDescription,
  submitLabel,
  mutationFn,
}: {
  title: string;
  description: string;
  sentTitle: string;
  sentDescription: string;
  submitLabel: string;
  mutationFn: (email: string) => Promise<unknown>;
}) {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => mutationFn(values.email),
    onSuccess: () => setSent(true),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 404) {
        toast.error("Não encontramos uma conta com esse email");
        return;
      }
      if (err instanceof ApiError && err.code === "already_confirmed") {
        toast.error("Essa conta já está confirmada", {
          action: { label: "Ir pro login", onClick: () => (window.location.href = "/entrar") },
        });
        return;
      }
      toast.error("Não foi possível completar a ação. Tente de novo.");
    },
  });

  if (sent) {
    return (
      <AuthLayout title={sentTitle}>
        <EmptyState
          icon={<MailCheck className="size-8" />}
          title={sentDescription}
          action={
            <Link to="/entrar" className="text-sm font-medium text-primary-600 hover:underline">
              Voltar pro login
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={title} description={description}>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </FormField>
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          {submitLabel}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/entrar" className="hover:text-foreground">
          Voltar pro login
        </Link>
      </p>
    </AuthLayout>
  );
}
