import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { resetPassword, ApiError } from "@runcodes/api-client";
import { Button, EmptyState, FormField, Input, toast } from "@runcodes/ui";
import { CheckCircle2, XCircle } from "lucide-react";
import { AuthLayout } from "./components/AuthLayout";

const schema = z.object({ newPassword: z.string().min(8, "Mínimo de 8 caracteres") });
type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => resetPassword(email, token, values.newPassword),
    onSuccess: () => setDone(true),
    onError: (err) => {
      if (err instanceof ApiError && err.code === "reset_token_expired") {
        toast.error("O link expirou", {
          action: { label: "Pedir outro", onClick: () => navigate("/esqueci-senha") },
        });
        return;
      }
      toast.error("Link inválido ou já utilizado");
    },
  });

  if (!email || !token) {
    return (
      <AuthLayout title="Redefinir senha">
        <EmptyState
          icon={<XCircle className="size-8 text-danger" />}
          title="Link inválido"
          description="Verifique se abriu o link completo recebido por email."
          action={
            <Link to="/esqueci-senha" className="text-sm font-medium text-primary-600 hover:underline">
              Pedir um novo link
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Senha redefinida">
        <EmptyState
          icon={<CheckCircle2 className="size-8 text-success" />}
          title="Sua senha foi alterada"
          action={
            <Button asChild>
              <Link to="/entrar">Ir pro login</Link>
            </Button>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Redefinir senha" description={`Para ${email}`}>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <FormField label="Nova senha" htmlFor="newPassword" error={errors.newPassword?.message}>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register("newPassword")}
          />
        </FormField>
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          Redefinir senha
        </Button>
      </form>
    </AuthLayout>
  );
}
