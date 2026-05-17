import type { Request, Response } from "express";
import prisma from "../lib/prisma";

export async function listTickets(_req: Request, res: Response) {
  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: "desc" },
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
