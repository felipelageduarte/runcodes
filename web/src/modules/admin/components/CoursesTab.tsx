import { useQuery } from "@tanstack/react-query";
import { listCourses, listUniversities } from "@runcodes/api-client";
import { Button, EmptyState, Skeleton, Table, type TableColumn } from "@runcodes/ui";
import { CourseFormDialog } from "./CourseFormDialog";
import type { CourseSummary } from "@runcodes/api-client";

/** Catálogo de cursos — a API já existia (`GET /courses`), essa tela era o
 * gap: nenhuma UI consumia leitura, e não dava pra criar nada. Ver
 * gap-audit-2026-10.md (itens 1 e 13). */
export function CoursesTab() {
  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: () => listCourses({ pageSize: 100 }) });
  const universitiesQuery = useQuery({ queryKey: ["universities"], queryFn: listUniversities });

  const universityName = (id: number) => {
    const u = universitiesQuery.data?.find((u) => u.id === id);
    return u ? `${u.abbreviation}` : `#${id}`;
  };

  const columns: TableColumn<CourseSummary>[] = [
    { key: "code", header: "Código", render: (c) => c.code },
    { key: "title", header: "Título", render: (c) => c.title },
    { key: "university", header: "Universidade", render: (c) => universityName(c.universityId) },
  ];

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <CourseFormDialog trigger={<Button size="sm">Nova disciplina</Button>} />
      </div>
      {coursesQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !coursesQuery.data || coursesQuery.data.courses.length === 0 ? (
        <EmptyState title="Nenhuma disciplina cadastrada" />
      ) : (
        <Table
          columns={columns}
          rows={coursesQuery.data.courses}
          rowKey={(c) => c.id}
          density="compact"
          mobileCards
          emptyTitle="Nenhuma disciplina"
        />
      )}
    </div>
  );
}
