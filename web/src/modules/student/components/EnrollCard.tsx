import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@runcodes/ui";
import { useEnrollMutation } from "../hooks/useEnrollMutation";

const schema = z.object({ code: z.string().min(1, "Informe o código da turma") });
type FormValues = z.infer<typeof schema>;

export function EnrollCard() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useEnrollMutation({ onSuccess: () => reset() });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar em turma</CardTitle>
        <CardDescription>Peça o código de matrícula pro seu professor.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values.code))} className="space-y-3">
          <FormField label="Código da turma" htmlFor="enroll-code" error={errors.code?.message}>
            <Input id="enroll-code" {...register("code")} />
          </FormField>
          <Button type="submit" loading={mutation.isPending} className="w-full">
            <GraduationCap className="size-4" />
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
