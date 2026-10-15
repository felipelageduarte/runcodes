import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@runcodes/auth";
import { ApiError } from "@runcodes/api-client";
import { Button, FormField, Input, toast } from "@runcodes/ui";
import { AuthLayout } from "./components/AuthLayout";

const schema = z.object({
  email: z.string().min(1, "Informe seu email"),
  password: z.string().min(1, "Informe sua senha"),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      await login.mutateAsync(values);
      const from = (location.state as { from?: Location })?.from;
      navigate(from?.pathname ?? "/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "account_not_confirmed") {
        toast.error("Sua conta ainda não foi confirmada", {
          description: "Verifique seu email ou reenvie a confirmação.",
          action: { label: "Reenviar", onClick: () => navigate("/reenviar-confirmacao") },
        });
        return;
      }
      toast.error("Email ou senha incorretos");
    }
  }

  return (
    <AuthLayout title="run.codes" description="Entre com sua conta">
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </FormField>
        <FormField label="Senha" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
        </FormField>
        <Button type="submit" className="w-full" loading={login.isPending}>
          Entrar
        </Button>
      </form>
      <div className="mt-4 flex flex-col gap-1 text-center text-sm text-muted-foreground">
        <Link to="/esqueci-senha" className="hover:text-foreground">
          Esqueci minha senha
        </Link>
        <span>
          Não tem conta?{" "}
          <Link to="/cadastro" className="font-medium text-primary-600 hover:underline">
            Cadastre-se
          </Link>
        </span>
      </div>
    </AuthLayout>
  );
}
