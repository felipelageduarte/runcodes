import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarPlus, GraduationCap, Inbox } from "lucide-react";
import { useSession } from "@runcodes/auth";
import { Badge, Button, Card, CardContent, EmptyState, Skeleton, StaggerItem, StaggerList } from "@runcodes/ui";
import { formatRelativeDeadline } from "@runcodes/shared";
import { useExerciseQueue } from "./hooks/useExerciseQueue";
import { ExerciseStatusBadge } from "./components/ExerciseStatusBadge";
import { EnrollDialog } from "./components/EnrollDialog";

function QueueSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useSession();
  const { offerings, queue, isLoading, isError } = useExerciseQueue();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Olá, {user?.name}</h1>
        <EnrollDialog
          trigger={
            <Button variant="secondary" size="sm">
              <GraduationCap className="size-4" />
              Entrar em turma
            </Button>
          }
        />
      </div>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Exercícios</h2>

      {isLoading ? (
        <QueueSkeleton />
      ) : isError ? (
        <EmptyState title="Não foi possível carregar seus exercícios" description="Tente recarregar a página." />
      ) : offerings && offerings.open.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-8" />}
          title="Você ainda não entrou em nenhuma turma"
          description="Peça o código de matrícula pro seu professor."
          action={<EnrollDialog trigger={<Button size="sm">Entrar em turma</Button>} />}
        />
      ) : queue.length === 0 ? (
        <EmptyState title="Nenhum exercício disponível nas suas turmas abertas" />
      ) : (
        <StaggerList className="space-y-2">
          {queue.map((exercise) => (
            <StaggerItem key={exercise.id}>
              <Link to={`/exercicios/${exercise.id}`}>
                <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15, ease: "easeOut" }}>
                  <Card className="hover:border-primary-300 hover:shadow-popover">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{exercise.title}</p>
                        <p className="truncate text-sm text-muted-foreground">{exercise.offeringTitle}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <ExerciseStatusBadge commit={exercise.myLatestCommit} />
                        <span className="text-xs text-muted-foreground">
                          {exercise.isOpen ? (
                            formatRelativeDeadline(exercise.deadline)
                          ) : (
                            <Badge variant="neutral">Ainda não abriu</Badge>
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      {offerings && offerings.closed.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-medium text-muted-foreground">Turmas encerradas</h2>
          <ul className="space-y-2">
            {offerings.closed.map((offering) => (
              <li key={offering.id}>
                <Link
                  to={`/turmas/${offering.id}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  <CalendarPlus className="size-4" />
                  {offering.course?.title ?? `Turma #${offering.id}`}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
