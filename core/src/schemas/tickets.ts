import { z } from "zod";

export const ticketStatusSchema = z.enum(["OPEN", "RESOLVED", "CLOSED"]);
export const ticketCategorySchema = z.enum([
  "GENERAL_QUESTION",
  "TECHNICAL_QUESTION",
  "REFUND_REQUEST",
]);

export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketCategory = z.infer<typeof ticketCategorySchema>;
