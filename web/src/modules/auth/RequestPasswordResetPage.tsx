import { requestPasswordReset } from "@runcodes/api-client";
import { EmailOnlyForm } from "./components/EmailOnlyForm";

export function RequestPasswordResetPage() {
  return (
    <EmailOnlyForm
      title="Esqueci minha senha"
      description="Informe seu email pra receber um link de redefinição"
      sentTitle="Verifique seu email"
      sentDescription="Enviamos um link pra redefinir sua senha."
      submitLabel="Enviar link"
      mutationFn={requestPasswordReset}
    />
  );
}
