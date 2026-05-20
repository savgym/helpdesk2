import boss from "./boss";
import { CLASSIFY_TICKET_QUEUE, type ClassifyTicketJob } from "../workers/classifyTicket";

export function classifyTicketAsync(ticket: ClassifyTicketJob): void {
  void boss.send(CLASSIFY_TICKET_QUEUE, ticket);
}
