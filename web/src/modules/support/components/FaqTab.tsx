import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteQuestion, listQuestions } from "@runcodes/api-client";
import { useSession } from "@runcodes/auth";
import { UserType } from "@runcodes/shared";
import { Button, EmptyState, Skeleton, toast } from "@runcodes/ui";
import { QuestionFormDialog } from "./QuestionFormDialog";

export function FaqTab() {
  const { user } = useSession();
  const isAdmin = (user?.type ?? -1) >= UserType.ADMIN;
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["questions"], queryFn: () => listQuestions() });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteQuestion(id),
    onSuccess: () => {
      toast.success("Pergunta removida");
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
    onError: () => toast.error("Não foi possível remover"),
  });

  return (
    <div className="space-y-4 py-4">
      {isAdmin && (
        <div className="flex justify-end">
          <QuestionFormDialog trigger={<Button size="sm">Nova pergunta</Button>} />
        </div>
      )}

      {query.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !query.data || query.data.questions.length === 0 ? (
        <EmptyState title="Nenhuma pergunta cadastrada ainda" />
      ) : (
        <ul className="space-y-2">
          {query.data.questions.map((question) => (
            <li key={question.id} className="rounded-lg border border-border bg-card p-4">
              <p className="mb-1 font-medium text-foreground">{question.title}</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{question.text}</p>
              {isAdmin && (
                <div className="mt-3 flex gap-2">
                  <QuestionFormDialog
                    existing={question}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Editar
                      </Button>
                    }
                  />
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(question.id)}>
                    Remover
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
