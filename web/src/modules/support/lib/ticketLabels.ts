// O backend guarda type/priority como número cru, sem enum nomeado (nem
// o legado tinha — conferido em server/src/app/Model/Ticket.php). Esses
// rótulos são uma escolha nossa de UX, não um espelho de constante
// existente em algum lugar.
export const ticketTypeLabels: Record<number, string> = {
  0: "Dúvida",
  1: "Bug",
  2: "Sugestão",
  3: "Outro",
};

export const ticketPriorityLabels: Record<number, string> = {
  0: "Baixa",
  1: "Normal",
  2: "Alta",
  3: "Urgente",
  4: "Crítica",
};
