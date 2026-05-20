import { openai } from "@ai-sdk/openai";
import { ticketCategorySchema } from "@helpdesk/core";
import { generateText } from "ai";
import prisma from "./prisma";

const CATEGORIES = ticketCategorySchema.options.join(" | ");

type TicketInput = { id: number; subject: string; body: string };

export function classifyTicketAsync(ticket: TicketInput): void {
  void (async () => {
    try {
      const { text } = await generateText({
        model: openai("gpt-5-nano"),
        system: `You are a support ticket classifier. Given a ticket subject and body, respond with exactly one of these categories and nothing else:\n${CATEGORIES}\n\nGENERAL_QUESTION — general inquiries, account questions, how-to, billing info\nTECHNICAL_QUESTION — bugs, errors, integration issues, product malfunctions\nREFUND_REQUEST — refund, cancellation, chargeback, money-back requests`,
        prompt: `Subject: ${ticket.subject}\n\n${ticket.body}`,
      });

      const category = ticketCategorySchema.safeParse(text.trim());
      if (!category.success) {
        console.error(`[Classify] Unexpected response for ticket ${ticket.id}: "${text.trim()}"`);
        return;
      }

      await prisma.ticket.update({ where: { id: ticket.id }, data: { category: category.data } });
    } catch (err) {
      console.error(`[Classify] Failed to classify ticket ${ticket.id}:`, err);
    }
  })();
}
