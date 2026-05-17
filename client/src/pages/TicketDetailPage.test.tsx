import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TicketDetailPage from "./TicketDetailPage";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../components/BackLink", () => ({
  default: () => <a href="/tickets">Back to tickets</a>,
}));

vi.mock("../components/TicketDetailSkeleton", () => ({
  default: () => <div data-testid="skeleton" />,
}));

vi.mock("../components/TicketDetail", () => ({
  default: ({ ticket }: { ticket: { subject: string } }) => (
    <div data-testid="ticket-detail">{ticket.subject}</div>
  ),
}));

const mockApi = vi.mocked(api);

const TICKET = {
  id: 1,
  subject: "Cannot log in",
  body: "My account is locked.",
  status: "OPEN",
  category: null,
  senderEmail: "customer@example.com",
  senderName: "Jane Smith",
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-05-17T12:00:00.000Z",
  assignedTo: null,
  messages: [],
};

const AGENTS = [
  { id: "agent-1", name: "Alice Agent", email: "alice@company.com", role: "AGENT" },
];

function renderPage(ticketId = "1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TicketDetailPage", () => {
  describe("loading state", () => {
    it("shows the skeleton while the ticket is loading", () => {
      mockApi.get.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    });

    it("does not show TicketDetail while loading", () => {
      mockApi.get.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.queryByTestId("ticket-detail")).not.toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows an error message when the ticket fetch fails", async () => {
      mockApi.get.mockImplementation((url: string) => {
        if (url.startsWith("/tickets/")) return Promise.reject(new Error("Ticket not found"));
        return Promise.resolve(AGENTS);
      });
      renderPage();
      expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
    });

    it("does not show TicketDetail when the fetch fails", async () => {
      mockApi.get.mockImplementation((url: string) => {
        if (url.startsWith("/tickets/")) return Promise.reject(new Error("Ticket not found"));
        return Promise.resolve(AGENTS);
      });
      renderPage();
      await screen.findByText("Ticket not found");
      expect(screen.queryByTestId("ticket-detail")).not.toBeInTheDocument();
    });
  });

  describe("success state", () => {
    beforeEach(() => {
      mockApi.get.mockImplementation((url: string) => {
        if (url.startsWith("/tickets/")) return Promise.resolve(TICKET);
        if (url === "/users") return Promise.resolve(AGENTS);
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
    });

    it("renders TicketDetail with the ticket subject after loading", async () => {
      renderPage();
      expect(await screen.findByTestId("ticket-detail")).toBeInTheDocument();
      expect(screen.getByText("Cannot log in")).toBeInTheDocument();
    });

    it("hides the skeleton once data has loaded", async () => {
      renderPage();
      await screen.findByTestId("ticket-detail");
      expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
    });
  });
});
