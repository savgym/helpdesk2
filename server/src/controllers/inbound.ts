import type { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";

const emailSchema = z.object({
  from:     z.email({ error: "A valid sender email is required" }),
  fromName: z.string({ error: "Sender name is required" }).trim().min(1, "Sender name is required"),
  subject:  z.string({ error: "Subject is required" }).trim().min(1, "Subject is required"),
  body:     z.string({ error: "Body is required" }).trim().min(1, "Body is required"),
});

export async function receiveEmail(req: Request, res: Response) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ") || auth.slice(7) !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const result = emailSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const { from, fromName, subject, body } = result.data;

  const ticket = await prisma.ticket.create({
    data: {
      senderEmail: from.toLowerCase(),
      senderName:  fromName,
      subject,
      body,
    },
    select: { id: true, subject: true, senderEmail: true, senderName: true, createdAt: true },
  });

  res.status(201).json(ticket);
}
