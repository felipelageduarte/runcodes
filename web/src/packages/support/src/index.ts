/** Peças de suporte compartilhadas entre o módulo `support` (rota
 * /suporte, usuário final e staff) e o módulo `admin` (rotas
 * /admin/tickets e /admin/avisos). Módulo não importa módulo, então o
 * que os dois navegam vive aqui — ver docs/admin/frontend/overview.md,
 * "Regra de fronteira". */
export * from "./ticketLabels";
export * from "./TicketQueueTab";
export * from "./TicketEditDialog";
export * from "./AlertsTab";
export * from "./AlertFormDialog";
