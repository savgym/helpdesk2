import { z } from "zod";
import type { Request, Response } from "express";
import { ticketSortBySchema, ticketSortOrderSchema, ticketStatusSchema, ticketCategorySchema } from "@helpdesk/core";
import type { TicketStatus, TicketCategory } from "@helpdesk/core";
import prisma from "../lib/prisma";

const listTicketsQuerySchema = z.object({
  sortBy: ticketSortBySchema.optional().default("createdAt"),
  sortOrder: ticketSortOrderSchema.optional().default("desc"),
  search: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export async function listTickets(req: Request, res: Response) {
  const result = listTicketsQuerySchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const { sortBy, sortOrder, search, status, category, page, pageSize } = result.data;

  const statusValues = status
    ? status.split(",").filter((s): s is TicketStatus => ticketStatusSchema.safeParse(s).success)
    : [];

  const rawCategories = category ? category.split(",") : [];
  const enumCategories = rawCategories.filter((c): c is TicketCategory =>
    ticketCategorySchema.safeParse(c).success
  );
  const includeUncategorized = rawCategories.includes("NONE");

  const andConditions: object[] = [];

  if (search) {
    andConditions.push({
      OR: [
        { subject: { contains: search, mode: "insensitive" } },
        { senderName: { contains: search, mode: "insensitive" } },
        { senderEmail: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (statusValues.length) {
    andConditions.push({ status: { in: statusValues } });
  }

  if (enumCategories.length || includeUncategorized) {
    andConditions.push({
      OR: [
        ...(enumCategories.length ? [{ category: { in: enumCategories } }] : []),
        ...(includeUncategorized ? [{ category: null }] : []),
      ],
    });
  }

  const where = andConditions.length ? { AND: andConditions } : {};

  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        subject: true,
        status: true,
        category: true,
        senderEmail: true,
        senderName: true,
        createdAt: true,
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({
    data: tickets,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
