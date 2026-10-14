import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { listOfferings, type OfferingSummary } from "@runcodes/api-client";
import { Badge, Input, Pagination, Skeleton, Table, type TableColumn } from "@runcodes/ui";

const PAGE_SIZE = 25;

function termLabel(o: OfferingSummary): string {
  return `${o.year}/${o.term}`;
}

function staffNames(o: OfferingSummary): string {
  return o.professors.map((p) => p.name).join(", ") || "—";
}

/** Catálogo de todos os oferecimentos da plataforma — visão que o admin
 * tinha no run.codes original. Busca e paginação são server-side
 * (`GET /offerings?q=&page=`); o endpoint é exclusivo em status:
 * closed=false → só abertas, closed=true → só encerradas. */
export function OfferingsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Busca ou troca de status reposicionam na primeira página.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, showClosed]);

  const { data, isPending, isError, isPlaceholderData } = useQuery({
    queryKey: ["admin-offerings", showClosed, debouncedSearch, page],
    queryFn: () =>
      listOfferings({
        closed: showClosed,
        q: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const columns: TableColumn<OfferingSummary>[] = [
    {
      key: "course",
      header: "Disciplina",
      render: (o) => (
        <Link
          to={`/turmas/${o.id}/gerenciar`}
          className="font-medium text-primary-600 hover:underline"
        >
          <span className="font-mono text-xs text-muted-foreground">{o.course?.code}</span>{" "}
          {o.course?.title ?? "—"}
        </Link>
      ),
    },
    {
      key: "university",
      header: "Instituição",
      render: (o) => o.university?.abbreviation ?? "—",
    },
    { key: "term", header: "Período", render: termLabel },
    { key: "classroom", header: "Turma", render: (o) => o.classroom ?? "—" },
    { key: "professors", header: "Professores", render: staffNames },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (o) =>
        new Date(o.endDate).getTime() > Date.now() ? (
          <Badge variant="success">Aberta</Badge>
        ) : (
          <Badge variant="neutral">Encerrada</Badge>
        ),
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar disciplina, código, sala…"
            className="pl-9"
            aria-label="Buscar oferecimentos"
          />
        </div>
        <div
          role="group"
          aria-label="Filtrar por status"
          className="flex w-fit rounded-lg border border-border bg-muted/40 p-0.5"
        >
          <button
            type="button"
            onClick={() => setShowClosed(false)}
            aria-pressed={!showClosed}
            className={
              !showClosed
                ? "rounded-md bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-xs"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            Abertas
          </button>
          <button
            type="button"
            onClick={() => setShowClosed(true)}
            aria-pressed={showClosed}
            className={
              showClosed
                ? "rounded-md bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-xs"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            Encerradas
          </button>
        </div>
      </div>

      {isError ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Não foi possível carregar os oferecimentos. Recarregue a página para tentar de novo.
        </p>
      ) : isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Table
            columns={columns}
            rows={data.offerings}
            rowKey={(o) => o.id}
            density="compact"
            mobileCards
            emptyTitle="Nenhum oferecimento encontrado"
            emptyDescription={
              debouncedSearch
                ? "Nenhum resultado para a busca — tente outro termo."
                : "Ainda não existem oferecimentos cadastrados."
            }
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            onPageChange={setPage}
            className="mt-3"
          />
        </div>
      )}
    </section>
  );
}
