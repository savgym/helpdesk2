import type { TicketStatus, TicketCategory } from "@helpdesk/core";

export const STATUS_VARIANT: Record<TicketStatus, "default" | "secondary" | "outline"> = {
  OPEN: "default",
  RESOLVED: "secondary",
  CLOSED: "outline",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  GENERAL_QUESTION: "General",
  TECHNICAL_QUESTION: "Technical",
  REFUND_REQUEST: "Refund",
};
