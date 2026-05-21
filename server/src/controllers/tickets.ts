import { openai } from "@ai-sdk/openai";
import type { TicketCategory, TicketStatus } from "@helpdesk/core";
import {
  createMessageSchema,
  ticketCategorySchema,
  ticketSortBySchema,
  ticketSortOrderSchema,
  ticketStatusSchema,
} from "@helpdesk/core";
import { generateText } from "ai";
import type { Request, Response } from "express";
import { z } from "zod";
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

const polishReplySchema = z.object({
  draft: z.string().min(1, "Draft cannot be empty"),
});

export async function summarizeTicket(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid ticket id" });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: {
      subject: true,
      body: true,
      senderName: true,
      messages: {
        select: { body: true, senderType: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const conversation = [
    `Customer (${ticket.senderName}): ${ticket.body}`,
    ...ticket.messages.map((m) =>
      `${m.senderType === "AGENT" ? "Agent" : `Customer (${ticket.senderName})`}: ${m.body}`
    ),
  ].join("\n\n");

  let text: string;
  try {
    ({ text } = await generateText({
      model: openai("gpt-5-nano"),
      system: `You are a support ticket analyst. Summarize the support conversation concisely in 2-4 sentences. Cover: the customer's core issue, any steps taken so far, and the current resolution status. Be factual and neutral.`,
      prompt: `Subject: ${ticket.subject}\n\n${conversation}`,
    }));
  } catch (err: unknown) {
    console.error("[Summarize AI error]", err);
    const message = err instanceof Error ? err.message : "AI request failed";
    return res.status(502).json({ error: message });
  }

  res.json({ summary: text });
}

export async function polishReply(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid ticket id" });
  }

  const result = polishReplySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { subject: true, body: true, senderName: true },
  });
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const agentName = res.locals.session.user.name as string;

  let text: string;
  try {
    ({ text } = await generateText({
      model: openai("gpt-5-nano"),
      system: `You are a professional customer support agent. You will be given a support ticket and a draft reply written by an agent. Improve the reply to be clearer, more professional, empathetic, and concise. Address the customer by their first name. Return ONLY the improved reply body with no signature, preamble, or extra commentary.`,
      prompt: `Customer name: ${ticket.senderName}\nSupport ticket subject: ${ticket.subject}\nCustomer message: ${ticket.body}\n\nAgent draft reply:\n${result.data.draft}`,
    }));
  } catch (err: unknown) {
    console.error("[Polish AI error]", err);
    const message = err instanceof Error ? err.message : "AI request failed";
    return res.status(502).json({ error: message });
  }

  const signed = `${text}\n\nBest regards,\n${agentName}\nhttps://savasgmn.com`;
  res.json({ polished: signed });
}

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

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const message = await prisma.message.create({
    data: {
      ticketId: id,
      body: stripHtml(result.data.body),
      senderType: "AGENT",
    },
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

  const { sortBy, sortOrder, search, status, category, page, pageSize } =
    result.data;

  const statusValues: TicketStatus[] = status
    ? status
        .split(",")
        .filter(
          (s): s is TicketStatus => ticketStatusSchema.safeParse(s).success,
        )
    : [];

  const rawCategories = category ? category.split(",") : [];
  const enumCategories = rawCategories.filter(
    (c): c is TicketCategory => ticketCategorySchema.safeParse(c).success,
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
        ...(enumCategories.length
          ? [{ category: { in: enumCategories } }]
          : []),
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
