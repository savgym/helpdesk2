import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReplyForm from "./ReplyForm";
import { api } from "../lib/api";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const mockApi = vi.mocked(api);

const TICKET_ID = 7;

const NEW_MESSAGE = {
  id: "msg-1",
  body: "Hello, I can help with that.",
  senderType: "AGENT" as const,
  createdAt: "2026-05-17T10:00:00.000Z",
};

function renderForm(onSuccess = vi.fn()) {
  return renderWithQuery(<ReplyForm ticketId={TICKET_ID} onSuccess={onSuccess} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReplyForm", () => {
  describe("rendering", () => {
    it("renders a textarea and Send Reply button", () => {
      renderForm();
      expect(screen.getByPlaceholderText("Write your reply...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /send reply/i })).toBeInTheDocument();
    });

    it("renders the Reply heading", () => {
      renderForm();
      expect(screen.getByText("Reply")).toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("shows an error and does not call the API when submitted empty", async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByRole("button", { name: /send reply/i }));

      expect(await screen.findByText("Reply cannot be empty")).toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
    });
  });

  describe("successful submission", () => {
    beforeEach(() => {
      mockApi.post.mockResolvedValue(NEW_MESSAGE);
    });

    it("calls api.post with the correct endpoint and body", async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByPlaceholderText("Write your reply..."), "Hello, I can help with that.");
      await user.click(screen.getByRole("button", { name: /send reply/i }));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(`/tickets/${TICKET_ID}/messages`, {
          body: "Hello, I can help with that.",
        });
      });
    });

    it("calls onSuccess with the returned message", async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      renderForm(onSuccess);

      await user.type(screen.getByPlaceholderText("Write your reply..."), "Hello, I can help with that.");
      await user.click(screen.getByRole("button", { name: /send reply/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(NEW_MESSAGE));
    });

    it("clears the textarea after successful submission", async () => {
      const user = userEvent.setup();
      renderForm();

      const textarea = screen.getByPlaceholderText("Write your reply...");
      await user.type(textarea, "Hello, I can help with that.");
      await user.click(screen.getByRole("button", { name: /send reply/i }));

      await waitFor(() => expect(textarea).toHaveValue(""));
    });
  });

  describe("loading state", () => {
    it("disables the textarea and shows 'Sending…' while the request is in flight", async () => {
      const user = userEvent.setup();
      let resolve: (v: unknown) => void;
      mockApi.post.mockReturnValue(new Promise((r) => { resolve = r; }));
      renderForm();

      await user.type(screen.getByPlaceholderText("Write your reply..."), "Hello");
      await user.click(screen.getByRole("button", { name: /send reply/i }));

      expect(await screen.findByRole("button", { name: /sending/i })).toBeDisabled();
      expect(screen.getByPlaceholderText("Write your reply...")).toBeDisabled();

      resolve!(NEW_MESSAGE);
    });
  });

  describe("server error", () => {
    it("shows the error message returned by the server", async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue(new Error("Failed to send reply"));
      renderForm();

      await user.type(screen.getByPlaceholderText("Write your reply..."), "Hello");
      await user.click(screen.getByRole("button", { name: /send reply/i }));

      expect(await screen.findByText("Failed to send reply")).toBeInTheDocument();
    });

    it("does not call onSuccess when the request fails", async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      mockApi.post.mockRejectedValue(new Error("Network error"));
      renderForm(onSuccess);

      await user.type(screen.getByPlaceholderText("Write your reply..."), "Hello");
      await user.click(screen.getByRole("button", { name: /send reply/i }));

      await screen.findByText("Network error");
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
