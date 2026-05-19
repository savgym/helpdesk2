import { z } from "zod";
import type { Request, Response } from "express";
import { ticketSortBySchema, ticketSortOrderSchema, ticketStatusSchema, ticketCategorySchema, createMessageSchema } from "@helpdesk/core";
import type { TicketStatus, TicketCategory } from "@helpdesk/core";
import prisma from "../lib/prisma";
import { stripHtml } from "../lib/sanitize";

const listTicketsQuerySchema = z.object({
  sortBy: ticketSortBySchema.optional().default("createdAt"),
  sortOrder: ticketSortOrderSchema.optional().default("desc"),
  search: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
});

const updateTicketSchema = z.object({
  assignedToId: z.string().nullable().optional(),
  status: ticketStatusSchema.optional(),
  category: ticketCategorySchema.nullable().optional(),
});

export async function updateTicket(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid ticket id" });
  }

  const result = updateTicketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const { assignedToId, status, category } = result.data;

  if (assignedToId !== undefined && assignedToId !== null) {
    const agent = await prisma.user.findFirst({
      where: { id: assignedToId, deletedAt: null },
      select: { id: true },
    });
    if (!agent) {
      return res.status(400).json({ error: "Agent not found" });
    }
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: {
      ...(assignedToId !== undefined && { assignedToId }),
      ...(status !== undefined && { status }),
      ...(category !== undefined && { category }),
    },
    select: {
      id: true,
      status: true,
      category: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  res.json(ticket);
}

export async function createMessage(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid ticket id" });
  }

  const result = createMessageSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const message = await prisma.message.create({
    data: { ticketId: id, body: stripHtml(result.data.body), senderType: "AGENT" },
    select: { id: true, body: true, senderType: true, createdAt: true },
  });

  res.status(201).json(message);
}

export async function getTicket(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid ticket id" });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      body: true,
      status: true,
      category: true,
      senderEmail: true,
      senderName: true,
      createdAt: true,
      updatedAt: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      messages: {
        select: {
          id: true,
          body: true,
          senderType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  res.json(ticket);
}

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
