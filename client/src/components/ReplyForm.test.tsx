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

const POLISHED = { polished: "Thank you for reaching out. I have resolved the issue." };

function renderForm(onSuccess = vi.fn()) {
  return renderWithQuery(<ReplyForm ticketId={TICKET_ID} onSuccess={onSuccess} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReplyForm", () => {
  describe("rendering", () => {
    it("renders a textarea, Polish button, and Send Reply button", () => {
      renderForm();
      expect(screen.getByPlaceholderText("Write your reply...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /polish/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /send reply/i })).toBeInTheDocument();
    });

    it("renders the Reply heading", () => {
      renderForm();
      expect(screen.getByText("Reply")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("disables Send Reply when the textarea is empty", () => {
      renderForm();
      expect(screen.getByRole("button", { name: /send reply/i })).toBeDisabled();
    });

    it("disables Polish when the textarea is empty", () => {
      renderForm();
      expect(screen.getByRole("button", { name: /polish/i })).toBeDisabled();
    });

    it("enables both buttons once text is typed", async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByPlaceholderText("Write your reply..."), "Hello");

      expect(screen.getByRole("button", { name: /send reply/i })).toBeEnabled();
      expect(screen.getByRole("button", { name: /polish/i })).toBeEnabled();
    });

    it("does not call the API when Send Reply is clicked while disabled", async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByRole("button", { name: /send reply/i }));

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

  describe("send loading state", () => {
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

  describe("send server error", () => {
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

  describe("polish", () => {
    it("calls api.post with the correct polish endpoint and current draft", async () => {
      const user = userEvent.setup();
      mockApi.post.mockResolvedValue(POLISHED);
      renderForm();

      await user.type(screen.getByPlaceholderText("Write your reply..."), "hey fixed it try again");
      await user.click(screen.getByRole("button", { name: /polish/i }));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(`/tickets/${TICKET_ID}/polish`, {
          draft: "hey fixed it try again",
        });
      });
    });

    it("replaces the textarea content with the polished text", async () => {
      const user = userEvent.setup();
      mockApi.post.mockResolvedValue(POLISHED);
      renderForm();

      await user.type(screen.getByPlaceholderText("Write your reply..."), "hey fixed it try again");
      await user.click(screen.getByRole("button", { name: /polish/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Write your reply...")).toHaveValue(POLISHED.polished);
      });
    });

    it("shows 'Polishing…' and disables the textarea while in flight", async () => {
      const user = userEvent.setup();
      let resolve: (v: unknown) => void;
      mockApi.post.mockReturnValue(new Promise((r) => { resolve = r; }));
      renderForm();

      await user.type(screen.getByPlaceholderText("Write your reply..."), "Hello");
      await user.click(screen.getByRole("button", { name: /polish/i }));

      expect(await screen.findByRole("button", { name: /polishing/i })).toBeDisabled();
      expect(screen.getByPlaceholderText("Write your reply...")).toBeDisabled();

      resolve!(POLISHED);
    });

    it("disables Send Reply while polishing", async () => {
      const user = userEvent.setup();
      let resolve: (v: unknown) => void;
      mockApi.post.mockReturnValue(new Promise((r) => { resolve = r; }));
      renderForm();

      await user.type(screen.getByPlaceholderText("Write your reply..."), "Hello");
      await user.click(screen.getByRole("button", { name: /polish/i }));

      expect(await screen.findByRole("button", { name: /send reply/i })).toBeDisabled();

      resolve!(POLISHED);
    });

    it("shows the error message when polish fails", async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue(new Error("AI request failed"));
      renderForm();

      await user.type(screen.getByPlaceholderText("Write your reply..."), "Hello");
      await user.click(screen.getByRole("button", { name: /polish/i }));

      expect(await screen.findByText("AI request failed")).toBeInTheDocument();
    });

    it("does not clear the textarea when polish fails", async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue(new Error("AI request failed"));
      renderForm();

      const textarea = screen.getByPlaceholderText("Write your reply...");
      await user.type(textarea, "Hello");
      await user.click(screen.getByRole("button", { name: /polish/i }));

      await screen.findByText("AI request failed");
      expect(textarea).toHaveValue("Hello");
    });
  });
});
