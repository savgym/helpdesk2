import { openai } from "@ai-sdk/openai";
import { ticketCategorySchema } from "@helpdesk/core";
import { generateText } from "ai";
import type { Job } from "pg-boss";
import { autoResolveTicketAsync } from "../lib/autoResolve";
import prisma from "../lib/prisma";

export const CLASSIFY_TICKET_QUEUE = "classify-ticket";

export type ClassifyTicketJob = { id: number; subject: string; body: string; senderEmail: string; senderName: string };

export async function classifyTicketWorker(jobs: Job<ClassifyTicketJob>[]): Promise<void> {
  const { id, subject, body, senderEmail, senderName } = jobs[0].data;

  await prisma.ticket.update({ where: { id }, data: { status: "PROCESSING" } });

  const categories = ticketCategorySchema.options.join(" | ");

  const { text } = await generateText({
    model: openai("gpt-5-nano"),
    system: `You are a support ticket classifier. Given a ticket subject and body, respond with exactly one of these categories and nothing else:\n${categories}\n\nGENERAL_QUESTION — general inquiries, account questions, how-to, billing info\nTECHNICAL_QUESTION — bugs, errors, integration issues, product malfunctions\nREFUND_REQUEST — refund, cancellation, chargeback, money-back requests`,
    prompt: `Subject: ${subject}\n\n${body}`,
  });

  const category = ticketCategorySchema.safeParse(text.trim());
  if (!category.success) {
    throw new Error(`Unexpected classification response for ticket ${id}: "${text.trim()}"`);
  }

  await prisma.ticket.update({ where: { id }, data: { category: category.data } });

  autoResolveTicketAsync({ id, subject, body, senderEmail, senderName, category: category.data });
}
