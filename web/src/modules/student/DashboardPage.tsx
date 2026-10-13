import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarPlus, CheckCircle2, GraduationCap, Inbox, ListTodo, School, Settings } from "lucide-react";
import { useSession } from "@runcodes/auth";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
  StaggerItem,
  StaggerList,
  StatCard,
} from "@runcodes/ui";
import { formatRelativeDeadline, isApprovedScore, isOfferingStaff } from "@runcodes/shared";
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

  const teachingOfferings = offerings
    ? [...offerings.open, ...offerings.closed].filter((o) => isOfferingStaff(o, user?.email))
    : [];

  const approvedCount = queue.filter((e) => isApprovedScore(e.myLatestCommit?.score ?? null)).length;
  const totalTurmas = (offerings?.open.length ?? 0) + (offerings?.closed.length ?? 0);

  return (
    <div className="mx-auto max-w-4xl p-6">
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

      {!isLoading && !isError && offerings && offerings.open.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<School className="size-5" />} label="Turmas" value={totalTurmas} color="primary" />
          <StatCard icon={<ListTodo className="size-5" />} label="Pendentes" value={queue.length} color="warning" />
          <StatCard icon={<CheckCircle2 className="size-5" />} label="Aprovados" value={approvedCount} color="success" />
          {teachingOfferings.length > 0 && (
            <StatCard
              icon={<Settings className="size-5" />}
              label="Turmas lecionadas"
              value={teachingOfferings.length}
              color="purple"
            />
          )}
        </div>
      )}

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

      {teachingOfferings.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-medium text-muted-foreground">Turmas que você leciona</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {teachingOfferings.map((offering) => (
              <li key={offering.id}>
                <Link to={`/turmas/${offering.id}/gerenciar`}>
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15, ease: "easeOut" }}>
                    <Card className="hover:border-primary-300 hover:shadow-popover">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-purple/15 text-accent-purple">
                          <Settings className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">
                            {offering.course?.title ?? `Turma #${offering.id}`}
                          </p>
                          <p className="text-xs text-muted-foreground">Gerenciar turma</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Link>
              </li>
            ))}
          </ul>
        </>
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
