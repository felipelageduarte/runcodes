import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { confirmEmail } from "@runcodes/api-client";
import { Button, EmptyState, Skeleton } from "@runcodes/ui";
import { CheckCircle2, XCircle } from "lucide-react";
import { AuthLayout } from "./components/AuthLayout";

export function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const query = useQuery({
    queryKey: ["confirm-email", email, token],
    queryFn: () => confirmEmail(email, token),
    enabled: Boolean(email && token),
    retry: false,
  });

  return (
    <AuthLayout title="Confirmação de email">
      {!email || !token ? (
        <EmptyState
          icon={<XCircle className="size-8 text-danger" />}
          title="Link de confirmação inválido"
          description="Verifique se abriu o link completo recebido por email."
        />
      ) : query.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={<XCircle className="size-8 text-danger" />}
          title="Não foi possível confirmar seu email"
          description="O link pode ter expirado. Peça um novo na tela de login."
          action={
            <Link to="/reenviar-confirmacao" className="text-sm font-medium text-primary-600 hover:underline">
              Reenviar confirmação
            </Link>
          }
        />
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="size-8 text-success" />}
          title="Email confirmado!"
          description="Sua conta está ativa — já pode entrar."
          action={
            <Button asChild>
              <Link to="/entrar">Ir pro login</Link>
            </Button>
          }
        />
      )}
    </AuthLayout>
  );
}
