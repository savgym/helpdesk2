import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { classifyTicketAsync } from "../lib/classify";
import { getAIAgentId } from "../lib/aiAgent";
import prisma from "../lib/prisma";
import { stripHtml } from "../lib/sanitize";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const sendgridSchema = z.object({
  from:    z.string().min(1),
  subject: z.string().min(1),
  text:    z.string().optional(),
  html:    z.string().optional(),
}).refine((d) => d.text || d.html, { message: "Email body is required" });

function parseFrom(raw: string): { email: string; name: string } {
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || match[2].trim(), email: match[2].trim().toLowerCase() };
  }
  return { name: raw.trim(), email: raw.trim().toLowerCase() };
}

router.post("/inbound-email", upload.none(), async (req, res) => {
  const result = sendgridSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const { from, subject, text, html } = result.data;
  const { email, name } = parseFrom(from);
  const body = text?.trim() || stripHtml(html || "");

  if (!body) {
    res.status(400).json({ error: "Empty email body" });
    return;
  }

  const aiAgentId = await getAIAgentId();

  const ticket = await prisma.ticket.create({
    data: {
      senderEmail: email,
      senderName:  stripHtml(name),
      subject:     stripHtml(subject),
      body:        stripHtml(body),
      ...(aiAgentId && { assignedToId: aiAgentId }),
    },
    select: { id: true, subject: true, body: true, senderEmail: true, senderName: true, createdAt: true },
  });

  classifyTicketAsync(ticket);

  res.status(200).json(ticket);
});

export default router;
