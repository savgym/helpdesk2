import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TicketsTable } from "./TicketsTable";
import { api } from "../lib/api";
import type { TicketStatus, TicketCategory } from "@helpdesk/core";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const mockApi = vi.mocked(api);

interface Ticket {
  id: number;
  subject: string;
  status: TicketStatus;
  category: TicketCategory | null;
  senderEmail: string;
  senderName: string;
  createdAt: string;
}

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    subject: "Cannot log into my account",
    status: "OPEN",
    category: null,
    senderEmail: "customer@example.com",
    senderName: "Jane Smith",
    createdAt: "2026-05-17T04:28:21.275Z",
    ...overrides,
  };
}

function renderTable() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <TicketsTable />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TicketsTable", () => {
  describe("loading state", () => {
    it("renders skeleton rows while fetching", () => {
      mockApi.get.mockReturnValue(new Promise(() => {}));
      renderTable();
      expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
  });

  describe("column headers", () => {
    it("renders all five column headers", () => {
      mockApi.get.mockReturnValue(new Promise(() => {}));
      renderTable();
      for (const header of ["Subject", "Sender", "Status", "Category", "Created"]) {
        expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
      }
    });
  });

  describe("empty state", () => {
    it("shows 'No tickets yet.' when no tickets are returned", async () => {
      mockApi.get.mockResolvedValue([]);
      renderTable();
      expect(await screen.findByText("No tickets yet.")).toBeInTheDocument();
    });
  });

  describe("ticket data", () => {
    it("renders the subject as a link to /tickets/:id", async () => {
      mockApi.get.mockResolvedValue([makeTicket({ id: 42, subject: "Order problem" })]);
      renderTable();
      const link = await screen.findByRole("link", { name: "Order problem" });
      expect(link).toHaveAttribute("href", "/tickets/42");
    });

    it("shows the 'open' status badge", async () => {
      mockApi.get.mockResolvedValue([makeTicket({ status: "OPEN" })]);
      renderTable();
      await screen.findByRole("link");
      expect(screen.getByText("open")).toBeInTheDocument();
    });

    it("shows the 'resolved' status badge", async () => {
      mockApi.get.mockResolvedValue([makeTicket({ status: "RESOLVED" })]);
      renderTable();
      await screen.findByRole("link");
      expect(screen.getByText("resolved")).toBeInTheDocument();
    });

    it("shows the 'closed' status badge", async () => {
      mockApi.get.mockResolvedValue([makeTicket({ status: "CLOSED" })]);
      renderTable();
      await screen.findByRole("link");
      expect(screen.getByText("closed")).toBeInTheDocument();
    });

    it("shows '—' when category is null", async () => {
      mockApi.get.mockResolvedValue([makeTicket({ category: null })]);
      renderTable();
      await screen.findByRole("link");
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("shows 'General' for GENERAL_QUESTION category", async () => {
      mockApi.get.mockResolvedValue([makeTicket({ category: "GENERAL_QUESTION" })]);
      renderTable();
      expect(await screen.findByText("General")).toBeInTheDocument();
    });

    it("shows 'Technical' for TECHNICAL_QUESTION category", async () => {
      mockApi.get.mockResolvedValue([makeTicket({ category: "TECHNICAL_QUESTION" })]);
      renderTable();
      expect(await screen.findByText("Technical")).toBeInTheDocument();
    });

    it("shows 'Refund' for REFUND_REQUEST category", async () => {
      mockApi.get.mockResolvedValue([makeTicket({ category: "REFUND_REQUEST" })]);
      renderTable();
      expect(await screen.findByText("Refund")).toBeInTheDocument();
    });

    it("shows the sender name and email", async () => {
      mockApi.get.mockResolvedValue([makeTicket()]);
      renderTable();
      await screen.findByRole("link");
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("customer@example.com")).toBeInTheDocument();
    });

    it("renders multiple ticket rows", async () => {
      mockApi.get.mockResolvedValue([
        makeTicket({ id: 1, subject: "First ticket" }),
        makeTicket({ id: 2, subject: "Second ticket" }),
      ]);
      renderTable();
      expect(await screen.findByRole("link", { name: "First ticket" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Second ticket" })).toBeInTheDocument();
    });
  });

  describe("fetch error", () => {
    it("shows an error message when the fetch fails", async () => {
      mockApi.get.mockRejectedValue(new Error("Network error"));
      renderTable();
      expect(await screen.findByText("Network error")).toBeInTheDocument();
    });
  });
});
