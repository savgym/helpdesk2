import boss from "./boss";
import { AUTO_RESOLVE_TICKET_QUEUE, type AutoResolveTicketJob } from "../workers/autoResolveTicket";

export function autoResolveTicketAsync(ticket: AutoResolveTicketJob): void {
  void boss.send(AUTO_RESOLVE_TICKET_QUEUE, ticket);
}
