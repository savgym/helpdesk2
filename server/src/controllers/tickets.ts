import { z } from "zod";
import type { Request, Response } from "express";
import { ticketSortBySchema, ticketSortOrderSchema } from "@helpdesk/core";
import prisma from "../lib/prisma";

const listTicketsQuerySchema = z.object({
  sortBy: ticketSortBySchema.optional().default("createdAt"),
  sortOrder: ticketSortOrderSchema.optional().default("desc"),
});

export async function listTickets(req: Request, res: Response) {
  const result = listTicketsQuerySchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }
  const { sortBy, sortOrder } = result.data;
  const tickets = await prisma.ticket.findMany({
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      subject: true,
      status: true,
      category: true,
      senderEmail: true,
      senderName: true,
      createdAt: true,
    },
  });
  res.json(tickets);
}
