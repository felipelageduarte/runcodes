import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { signup, ApiError } from "@runcodes/api-client";
import { Button, FormField, Input, EmptyState } from "@runcodes/ui";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "./components/AuthLayout";

const schema = z.object({
  name: z.string().min(1, "Informe seu nome"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo de 8 caracteres"),
});
type FormValues = z.infer<typeof schema>;

export function SignupPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: signup,
    onSuccess: (data) => setSentTo(data.email),
    onError: (err) => {
      if (err instanceof ApiError && err.code === "email_already_registered") {
        setError("email", { message: "Já existe uma conta com este email" });
        return;
      }
    },
  });

  if (sentTo) {
    return (
      <AuthLayout title="Confirme seu email">
        <EmptyState
          icon={<MailCheck className="size-8" />}
          title={`Enviamos um link de confirmação para ${sentTo}`}
          description="Abra o email e clique no link para ativar sua conta."
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
    <AuthLayout title="Criar conta" description="Cadastre-se no run.codes">
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <FormField label="Nome" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" {...register("name")} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </FormField>
        <FormField label="Senha" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        </FormField>
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          Criar conta
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/entrar" className="font-medium text-primary-600 hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
