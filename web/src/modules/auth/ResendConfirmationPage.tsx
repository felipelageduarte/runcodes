import { resendConfirmation } from "@runcodes/api-client";
import { EmailOnlyForm } from "./components/EmailOnlyForm";

export function ResendConfirmationPage() {
  return (
    <EmailOnlyForm
      title="Reenviar confirmação"
      description="Informe o email usado no cadastro"
      sentTitle="Verifique seu email"
      sentDescription="Enviamos um novo link de confirmação."
      submitLabel="Reenviar"
      mutationFn={resendConfirmation}
    />
  );
}
