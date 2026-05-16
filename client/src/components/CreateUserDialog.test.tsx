import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateUserDialog } from "./CreateUserDialog";
import { api } from "../lib/api";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn() },
}));

const mockApi = vi.mocked(api);

function makeCreatedUser() {
  return {
    id: "3",
    name: "Alice New",
    email: "alice@test.com",
    role: "AGENT" as const,
    createdAt: "2024-01-01T00:00:00Z",
  };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /new user/i }));
  await screen.findByRole("dialog");
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { name = "Alice New", email = "alice@test.com", password = "password123" } = {}
) {
  await user.type(screen.getByLabelText("Name"), name);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreateUserDialog", () => {
  describe("form validation", () => {
    it("shows all field errors when submitting an empty form", async () => {
      const user = userEvent.setup();
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);

      await user.click(screen.getByRole("button", { name: /create user/i }));

      expect(await screen.findByText("Name must be at least 3 characters")).toBeInTheDocument();
      expect(screen.getByText("A valid email is required")).toBeInTheDocument();
      expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it("marks all invalid fields with aria-invalid", async () => {
      const user = userEvent.setup();
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);

      await user.click(screen.getByRole("button", { name: /create user/i }));

      await screen.findByText("Name must be at least 3 characters");
      expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    });

    it("shows a name error when name is too short", async () => {
      const user = userEvent.setup();
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);

      await fillForm(user, { name: "ab" });
      await user.click(screen.getByRole("button", { name: /create user/i }));

      expect(await screen.findByText("Name must be at least 3 characters")).toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it("shows an email error when email is invalid", async () => {
      const user = userEvent.setup();
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);

      await fillForm(user, { email: "notanemail" });
      await user.click(screen.getByRole("button", { name: /create user/i }));

      expect(await screen.findByText("A valid email is required")).toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it("shows a password error when password is too short", async () => {
      const user = userEvent.setup();
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);

      await fillForm(user, { password: "short" });
      await user.click(screen.getByRole("button", { name: /create user/i }));

      expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
    });
  });

  describe("successful submission", () => {
    beforeEach(() => {
      mockApi.post.mockResolvedValue(makeCreatedUser());
    });

    it("calls api.post with the submitted form data", async () => {
      const user = userEvent.setup();
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);
      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /create user/i }));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith("/users", {
          name: "Alice New",
          email: "alice@test.com",
          password: "password123",
        });
      });
    });

    it("closes the dialog after successful submission", async () => {
      const user = userEvent.setup();
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);
      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /create user/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("resets the form so it is empty when the dialog is reopened", async () => {
      const user = userEvent.setup();
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);
      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /create user/i }));
      await waitFor(() => { expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); });

      await openDialog(user);

      expect(screen.getByLabelText("Name")).toHaveValue("");
      expect(screen.getByLabelText("Email")).toHaveValue("");
      expect(screen.getByLabelText("Password")).toHaveValue("");
    });
  });

  describe("server errors", () => {
    it("shows the error as an email field error when the server returns a duplicate email", async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue(new Error("A user with that email already exists"));
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);
      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /create user/i }));

      expect(await screen.findByText("A user with that email already exists")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
      // shown as a field error, not a banner — only one instance
      expect(screen.getAllByText("A user with that email already exists")).toHaveLength(1);
    });

    it("shows a banner for generic server errors and does not mark the email field invalid", async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue(new Error("Internal server error"));
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);
      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /create user/i }));

      expect(await screen.findByText("Internal server error")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("cancel", () => {
    it("closes the dialog when Cancel is clicked", async () => {
      const user = userEvent.setup();
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("resets the form so it is empty when the dialog is reopened after cancel", async () => {
      const user = userEvent.setup();
      renderWithQuery(<CreateUserDialog />);
      await openDialog(user);
      await user.type(screen.getByLabelText("Name"), "Alice New");
      await user.type(screen.getByLabelText("Email"), "alice@test.com");
      await user.click(screen.getByRole("button", { name: /cancel/i }));
      await waitFor(() => { expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); });

      await openDialog(user);

      expect(screen.getByLabelText("Name")).toHaveValue("");
      expect(screen.getByLabelText("Email")).toHaveValue("");
    });
  });
});
