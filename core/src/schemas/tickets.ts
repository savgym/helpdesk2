import { z } from "zod";

export const ticketStatusSchema = z.enum(["NEW", "PROCESSING", "OPEN", "RESOLVED", "CLOSED"]);
export const ticketCategorySchema = z.enum([
  "GENERAL_QUESTION",
  "TECHNICAL_QUESTION",
  "REFUND_REQUEST",
]);

export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketCategory = z.infer<typeof ticketCategorySchema>;

export const ticketSortBySchema = z.enum([
  "subject",
  "senderName",
  "status",
  "category",
  "createdAt",
]);
export const ticketSortOrderSchema = z.enum(["asc", "desc"]);

export type TicketSortBy = z.infer<typeof ticketSortBySchema>;
export type TicketSortOrder = z.infer<typeof ticketSortOrderSchema>;

export const createMessageSchema = z.object({
  body: z.string().min(1, "Reply cannot be empty").max(10000, "Reply is too long"),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const dashboardStatsSchema = z.object({
  totalTickets: z.number().int(),
  openTickets: z.number().int(),
  resolvedByAI: z.number().int(),
  resolvedByAIPercent: z.number(),
  avgResolutionMinutes: z.number().nullable(),
  ticketsPerDay: z.array(z.object({ date: z.string(), count: z.number().int() })),
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
