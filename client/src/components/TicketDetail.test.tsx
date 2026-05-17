import React from "react";
import { vi, describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQuery } from "../test/renderWithQuery";
import TicketDetail, { type Ticket, type Agent, type Message } from "./TicketDetail";

vi.mock("./ReplyForm", () => ({
  default: () => <div data-testid="reply-form" />,
}));

vi.mock("./UpdateTicket", () => ({
  default: () => <div data-testid="update-ticket" />,
}));

const AGENTS: Agent[] = [
  { id: "agent-1", name: "Alice Agent", email: "alice@company.com", role: "AGENT" },
];

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    subject: "Cannot log in",
    body: "I have been unable to log into my account since yesterday.",
    status: "OPEN",
    category: "TECHNICAL_QUESTION",
    senderEmail: "customer@example.com",
    senderName: "Jane Smith",
    createdAt: "2026-05-17T10:00:00.000Z",
    updatedAt: "2026-05-17T12:00:00.000Z",
    assignedTo: { id: "agent-1", name: "Alice Agent", email: "alice@company.com" },
    messages: [],
    ...overrides,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    body: "Can you help me reset my password?",
    senderType: "CUSTOMER",
    createdAt: "2026-05-17T11:00:00.000Z",
    ...overrides,
  };
}

function renderDetail(ticket: Ticket = makeTicket()) {
  return renderWithQuery(
    <TicketDetail
      ticket={ticket}
      agents={AGENTS}
      onUpdate={vi.fn()}
      isPending={false}
      onReplySuccess={vi.fn()}
    />
  );
}

describe("TicketDetail", () => {
  describe("ticket header", () => {
    it("renders the ticket subject", () => {
      renderDetail();
      expect(screen.getByRole("heading", { name: "Cannot log in" })).toBeInTheDocument();
    });

    it("renders the sender name and email in the header", () => {
      renderDetail();
      expect(screen.getByText(/Jane Smith \(customer@example\.com\)/)).toBeInTheDocument();
    });
  });

  describe("original message card", () => {
    it("renders the ticket body", () => {
      renderDetail();
      expect(
        screen.getByText("I have been unable to log into my account since yesterday.")
      ).toBeInTheDocument();
    });

    it("shows a 'Message' label with a 'Customer' badge for the original message", () => {
      renderDetail();
      const messagLabels = screen.getAllByText("Message");
      expect(messagLabels.length).toBeGreaterThan(0);
      const customerBadges = screen.getAllByText("Customer");
      expect(customerBadges.length).toBeGreaterThan(0);
    });
  });

  describe("reply thread", () => {
    it("renders no additional messages when messages array is empty", () => {
      renderDetail(makeTicket({ messages: [] }));
      expect(screen.queryByText("Reply")).not.toBeInTheDocument();
    });

    it("renders a customer message with 'Message' label and 'Customer' badge", () => {
      const msg = makeMessage({ body: "My account is locked.", senderType: "CUSTOMER" });
      renderDetail(makeTicket({ messages: [msg] }));
      expect(screen.getByText("My account is locked.")).toBeInTheDocument();
      const customerBadges = screen.getAllByText("Customer");
      expect(customerBadges.length).toBeGreaterThanOrEqual(1);
    });

    it("renders a customer message attribution with sender name", () => {
      const msg = makeMessage({ senderType: "CUSTOMER" });
      renderDetail(makeTicket({ messages: [msg] }));
      const fromSender = screen.getAllByText(/From Jane Smith/);
      expect(fromSender.length).toBeGreaterThan(0);
    });

    it("renders an agent reply with 'Reply' label and 'Agent' badge", () => {
      const msg = makeMessage({ body: "Let me help you.", senderType: "AGENT" });
      renderDetail(makeTicket({ messages: [msg] }));
      expect(screen.getByText("Let me help you.")).toBeInTheDocument();
      expect(screen.getByText("Reply")).toBeInTheDocument();
      expect(screen.getByText("Agent")).toBeInTheDocument();
    });

    it("attributes an agent reply to the assigned agent's name", () => {
      const msg = makeMessage({ senderType: "AGENT" });
      renderDetail(makeTicket({ messages: [msg] }));
      expect(screen.getByText(/From Alice Agent/)).toBeInTheDocument();
    });

    it("falls back to 'Agent' when ticket has no assignedTo and message is from AGENT", () => {
      const msg = makeMessage({ senderType: "AGENT" });
      renderDetail(makeTicket({ assignedTo: null, messages: [msg] }));
      expect(screen.getByText(/From Agent/)).toBeInTheDocument();
    });

    it("renders multiple messages in order", () => {
      const msgs: Message[] = [
        makeMessage({ id: "msg-1", body: "First customer message.", senderType: "CUSTOMER" }),
        makeMessage({ id: "msg-2", body: "Agent reply here.", senderType: "AGENT" }),
      ];
      renderDetail(makeTicket({ messages: msgs }));
      expect(screen.getByText("First customer message.")).toBeInTheDocument();
      expect(screen.getByText("Agent reply here.")).toBeInTheDocument();
    });
  });

  describe("sub-components", () => {
    it("renders the ReplyForm", () => {
      renderDetail();
      expect(screen.getByTestId("reply-form")).toBeInTheDocument();
    });

    it("renders the UpdateTicket sidebar", () => {
      renderDetail();
      expect(screen.getByTestId("update-ticket")).toBeInTheDocument();
    });
  });
});
