/** "vence em 6h" em vez de só a data absoluta — ver
 * docs/frontend/journeys.md#dashboard--fila-de-trabalho-não-lista-de-turmas. */
export function formatRelativeDeadline(deadline: string | Date): string {
  const target = new Date(deadline).getTime();
  const diffMs = target - Date.now();

  if (diffMs <= 0) return "Prazo encerrado";

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `Vence em ${minutes}min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Vence em ${hours}h`;

  const days = Math.round(hours / 24);
  if (days === 1) return "Vence em 1 dia";
  if (days <= 14) return `Vence em ${days} dias`;

  return `Vence em ${new Date(deadline).toLocaleDateString("pt-BR")}`;
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Link público do Google Calendar — não precisa de auth/API key, é só a
 * URL de "criar evento" preenchida (ExercisesController::exportExerciseToGoogleCalendar()
 * no legado faz o equivalente). */
export function googleCalendarUrl(title: string, deadline: string | Date): string {
  const end = new Date(deadline);
  const start = new Date(end.getTime() - 60 * 60 * 1000); // 1h de duração, só pra ter um bloco visível
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Prazo: ${title}`,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
