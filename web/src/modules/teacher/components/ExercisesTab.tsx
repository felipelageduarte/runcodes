import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteExercise, type ExerciseListItem, type OfferingDetail } from "@runcodes/api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  toast,
} from "@runcodes/ui";
import { ShareExerciseDialog } from "./ShareExerciseDialog";
import { CloneExerciseDialog } from "./CloneExerciseDialog";
import { PublishDialog } from "./PublishDialog";

const typeLabels: Record<number, string> = { 0: "Compilável", 1: "Não compilável", 2: "Compilável (makefile)" };

export function ExercisesTab({ offering }: { offering: OfferingDetail }) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<ExerciseListItem | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteExercise(id),
    onSuccess: () => {
      toast.success("Exercício removido");
      queryClient.invalidateQueries({ queryKey: ["offering", offering.id] });
      setConfirmDelete(null);
    },
    onError: () => toast.error("Não foi possível remover o exercício"),
  });

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button asChild size="sm">
          <Link to={`/turmas/${offering.id}/exercicios/novo`}>Novo exercício</Link>
        </Button>
      </div>

      {offering.exercises.length === 0 ? (
        <EmptyState title="Nenhum exercício nessa turma ainda" />
      ) : (
        <ul className="space-y-2">
          {offering.exercises.map((exercise) => (
            <li key={exercise.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">{exercise.title}</p>
                      {exercise.ghost && <Badge variant="info">Ghost</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {typeLabels[exercise.type] ?? "—"} · prazo {new Date(exercise.deadline).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/exercicios/${exercise.id}/gerenciar`}>Casos/stats</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/exercicios/${exercise.id}/editar`}>Editar</Link>
                    </Button>
                    <ShareExerciseDialog
                      exercise={exercise}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Compartilhar
                        </Button>
                      }
                    />
                    <CloneExerciseDialog
                      exercise={exercise}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Clonar
                        </Button>
                      }
                    />
                    {!exercise.ghost && (
                      <PublishDialog
                        exerciseId={exercise.id}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Publicar
                          </Button>
                        }
                      />
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(exercise)}>
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent open={confirmDelete !== null}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover exercício?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.ghost
                ? "Esse exercício foi compartilhado de outra turma. Removê-lo apaga o exercício original e todas as cópias compartilhadas em outras turmas — não só nesta."
                : "Os alunos perdem acesso a esse exercício e suas submissões anteriores. Se esse exercício foi compartilhado com outras turmas, as cópias (ghost) também somem."}{" "}
              Essa ação não pode ser desfeita pela interface.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
