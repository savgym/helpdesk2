import { Router } from "express";
import multer from "multer";
import Parse from "@sendgrid/inbound-mail-parser";
import { classifyTicketAsync } from "../lib/classify";
import { getAIAgentId } from "../lib/aiAgent";
import prisma from "../lib/prisma";
import { stripHtml } from "../lib/sanitize";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function parseFrom(raw: string): { email: string; name: string } {
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || match[2].trim(), email: match[2].trim().toLowerCase() };
  }
  return { name: raw.trim(), email: raw.trim().toLowerCase() };
}

router.post("/inbound-email", upload.none(), async (req, res) => {
  const raw = (req.body ?? {}) as Record<string, string>;

  if (!raw.from || !raw.subject || (!raw.text && !raw.html)) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const parse = new Parse({ keys: ["from", "subject", "text", "html"] }, { body: req.body });
  const fields = parse.keyValues() as Record<string, string>;

  const { email, name } = parseFrom(fields.from);
  const body = fields.text?.trim() || stripHtml(fields.html || "");

  if (!body) {
    res.status(400).json({ error: "Empty email body" });
    return;
  }

  const aiAgentId = await getAIAgentId();

  const ticket = await prisma.ticket.create({
    data: {
      senderEmail: email,
      senderName:  stripHtml(name),
      subject:     stripHtml(fields.subject),
      body,
      ...(aiAgentId && { assignedToId: aiAgentId }),
    },
    select: { id: true, subject: true, body: true, senderEmail: true, senderName: true, createdAt: true },
  });

  classifyTicketAsync(ticket);

  res.status(200).json(ticket);
});

export default router;
