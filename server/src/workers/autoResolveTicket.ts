import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import * as fs from "fs";
import type { Job } from "pg-boss";
import * as path from "path";
import { z } from "zod";
import prisma from "../lib/prisma";

export const AUTO_RESOLVE_TICKET_QUEUE = "auto-resolve-ticket";

export type AutoResolveTicketJob = {
  id: number;
  subject: string;
  body: string;
  senderName: string;
  category: string;
};

const autoResolveOutputSchema = z.object({
  resolve: z.boolean(),
  message: z.string().nullable(),
});

export async function autoResolveTicketWorker(
  jobs: Job<AutoResolveTicketJob>[]
): Promise<void> {
  const { id, subject, body, senderName, category } = jobs[0].data;

  const firstName = senderName.split(" ")[0];

  const knowledgeBase = fs.readFileSync(
    path.resolve(process.cwd(), "knowledge-base.md"),
    "utf-8"
  );

  let object: z.infer<typeof autoResolveOutputSchema>;
  try {
    const { text } = await generateText({
      model: openai("gpt-5-nano"),
      system: `You are a support agent for "Code with Savvas". Use the knowledge base below to resolve customer support tickets automatically.

Respond with a JSON object with exactly two fields:
- "resolve": true if the knowledge base contains a clear, complete answer; false otherwise.
- "message": the reply string when resolve is true, or null when resolve is false.

Set resolve to false if ANY of the following apply:
- The customer threatens legal action.
- The customer requests a refund outside the 30-day window.
- The customer disputes a charge or mentions a chargeback.
- The issue involves account security concerns (hacking, fraud, unauthorized access).
- You are not confident the knowledge base fully addresses the issue.

When resolve is true, write the reply in the message field following these rules:
- Open with "Hi ${firstName}," on its own line.
- Write 1–3 short paragraphs that directly and warmly address the customer's issue.
- Use a professional, empathetic, and friendly tone.
- Do NOT include a closing or signature — those will be added automatically.

Respond with raw JSON only. No markdown, no code fences.

KNOWLEDGE BASE:
${knowledgeBase}`,
      prompt: `Ticket category: ${category}
Subject: ${subject}

${body}`,
    });

    const parsed = autoResolveOutputSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(`Unexpected AI response for ticket ${id}: "${text}"`);
    }
    object = parsed.data;
  } catch (err) {
    console.error(`[auto-resolve] AI error for ticket ${id}:`, err);
    await prisma.ticket.update({ where: { id }, data: { status: "OPEN", assignedToId: null } });
    return;
  }

  if (!object.resolve || !object.message) {
    await prisma.ticket.update({ where: { id }, data: { status: "OPEN", assignedToId: null } });
    return;
  }

  const signed = `${object.message}\n\nWarm regards,\nCode with Savvas Support`;

  await prisma.$transaction([
    prisma.message.create({
      data: { ticketId: id, body: signed, senderType: "AGENT" },
    }),
    prisma.ticket.update({
      where: { id },
      data: { status: "RESOLVED", resolvedByAI: true, resolvedAt: new Date() },
    }),
  ]);

  console.log(`[auto-resolve] Ticket ${id} auto-resolved.`);
}
