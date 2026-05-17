import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import UpdateTicket from "./UpdateTicket";
import type { Ticket, Agent, UpdateTicketPayload } from "./TicketDetail";

vi.mock("./ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

const AGENTS: Agent[] = [
  { id: "agent-1", name: "Alice Agent", email: "alice@company.com", role: "AGENT" },
  { id: "agent-2", name: "Bob Agent", email: "bob@company.com", role: "AGENT" },
];

function makeTicketProps(
  overrides: Partial<Pick<Ticket, "status" | "category" | "assignedTo" | "createdAt" | "updatedAt">> = {}
) {
  return {
    status: "OPEN" as const,
    category: "TECHNICAL_QUESTION" as const,
    assignedTo: { id: "agent-1", name: "Alice Agent", email: "alice@company.com" },
    createdAt: "2026-05-17T10:00:00.000Z",
    updatedAt: "2026-05-17T12:00:00.000Z",
    ...overrides,
  };
}

function renderSidebar(
  overrides: Parameters<typeof makeTicketProps>[0] = {},
  onUpdate: (p: UpdateTicketPayload) => void = vi.fn(),
  isPending = false
) {
  const ticket = makeTicketProps(overrides);
  return {
    onUpdate,
    ...render(
      <UpdateTicket ticket={ticket} agents={AGENTS} onUpdate={onUpdate} isPending={isPending} />
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UpdateTicket", () => {
  describe("initial values", () => {
    it("shows the current status in the status select", () => {
      renderSidebar({ status: "OPEN" });
      const selects = screen.getAllByRole("combobox");
      expect(selects[0]).toHaveValue("OPEN");
    });

    it("shows the current category in the category select", () => {
      renderSidebar({ category: "REFUND_REQUEST" });
      const selects = screen.getAllByRole("combobox");
      expect(selects[1]).toHaveValue("REFUND_REQUEST");
    });

    it("shows 'none' when category is null", () => {
      renderSidebar({ category: null });
      const selects = screen.getAllByRole("combobox");
      expect(selects[1]).toHaveValue("none");
    });

    it("shows the current assignee id in the assignee select", () => {
      renderSidebar({ assignedTo: { id: "agent-2", name: "Bob Agent", email: "bob@company.com" } });
      const selects = screen.getAllByRole("combobox");
      expect(selects[2]).toHaveValue("agent-2");
    });

    it("shows 'unassigned' when no assignee", () => {
      renderSidebar({ assignedTo: null });
      const selects = screen.getAllByRole("combobox");
      expect(selects[2]).toHaveValue("unassigned");
    });
  });

  describe("options", () => {
    it("renders Open, Resolved, and Closed status options", () => {
      renderSidebar();
      expect(screen.getByRole("option", { name: "Open" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Resolved" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Closed" })).toBeInTheDocument();
    });

    it("renders Uncategorized and all category options", () => {
      renderSidebar();
      expect(screen.getByRole("option", { name: "Uncategorized" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "General" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Technical" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Refund" })).toBeInTheDocument();
    });

    it("renders Unassigned and each agent as an option", () => {
      renderSidebar();
      expect(screen.getByRole("option", { name: "Unassigned" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Alice Agent" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Bob Agent" })).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("calls onUpdate with the new status when status select changes", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      renderSidebar({}, onUpdate);

      const selects = screen.getAllByRole("combobox");
      await user.selectOptions(selects[0], "RESOLVED");

      expect(onUpdate).toHaveBeenCalledWith({ status: "RESOLVED" });
    });

    it("calls onUpdate with the new category when category select changes", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      renderSidebar({}, onUpdate);

      const selects = screen.getAllByRole("combobox");
      await user.selectOptions(selects[1], "GENERAL_QUESTION");

      expect(onUpdate).toHaveBeenCalledWith({ category: "GENERAL_QUESTION" });
    });

    it("calls onUpdate with category: null when 'Uncategorized' is chosen", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      renderSidebar({ category: "REFUND_REQUEST" }, onUpdate);

      const selects = screen.getAllByRole("combobox");
      await user.selectOptions(selects[1], "none");

      expect(onUpdate).toHaveBeenCalledWith({ category: null });
    });

    it("calls onUpdate with assignedToId when an agent is selected", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      renderSidebar({ assignedTo: null }, onUpdate);

      const selects = screen.getAllByRole("combobox");
      await user.selectOptions(selects[2], "agent-1");

      expect(onUpdate).toHaveBeenCalledWith({ assignedToId: "agent-1" });
    });

    it("calls onUpdate with assignedToId: null when 'Unassigned' is chosen", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      renderSidebar({ assignedTo: { id: "agent-1", name: "Alice Agent", email: "alice@company.com" } }, onUpdate);

      const selects = screen.getAllByRole("combobox");
      await user.selectOptions(selects[2], "unassigned");

      expect(onUpdate).toHaveBeenCalledWith({ assignedToId: null });
    });
  });

  describe("pending state", () => {
    it("disables all selects while isPending is true", () => {
      renderSidebar({}, vi.fn(), true);
      const selects = screen.getAllByRole("combobox");
      for (const select of selects) {
        expect(select).toBeDisabled();
      }
    });

    it("enables all selects when isPending is false", () => {
      renderSidebar({}, vi.fn(), false);
      const selects = screen.getAllByRole("combobox");
      for (const select of selects) {
        expect(select).not.toBeDisabled();
      }
    });
  });

  describe("metadata", () => {
    it("shows the created date", () => {
      renderSidebar({ createdAt: "2026-05-17T10:00:00.000Z" });
      expect(screen.getByText(/Created/)).toBeInTheDocument();
    });

    it("shows the updated date", () => {
      renderSidebar({ updatedAt: "2026-05-17T12:00:00.000Z" });
      expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });
  });
});
