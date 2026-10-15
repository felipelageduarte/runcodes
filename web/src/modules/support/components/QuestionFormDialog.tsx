import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createQuestion, updateQuestion, type QuestionRecord } from "@runcodes/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  Textarea,
  toast,
} from "@runcodes/ui";

const schema = z.object({
  title: z.string().min(1, "Informe a pergunta"),
  text: z.string().min(1, "Informe a resposta"),
  tags: z.string().optional(),
});
type FormValues = z.input<typeof schema>;

export function QuestionFormDialog({ existing, trigger }: { existing?: QuestionRecord; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? { title: existing.title ?? "", text: existing.text ?? "", tags: existing.tags ?? "" }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = { title: values.title, text: values.text, tags: values.tags?.trim() ? values.tags : null };
      return existing ? updateQuestion(existing.id, input) : createQuestion(input);
    },
    onSuccess: () => {
      toast.success(existing ? "Pergunta atualizada" : "Pergunta criada");
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("Não foi possível salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>{existing ? "Editar pergunta" : "Nova pergunta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Pergunta" htmlFor="title" error={errors.title?.message}>
            <Input id="title" {...register("title")} />
          </FormField>
          <FormField label="Resposta" htmlFor="text" error={errors.text?.message}>
            <Textarea id="text" rows={5} {...register("text")} />
          </FormField>
          <FormField label="Tags (opcional)" htmlFor="tags" hint="Separadas por espaço">
            <Input id="tags" {...register("tags")} />
          </FormField>
          <DialogFooter>
            <Button type="submit" loading={mutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
