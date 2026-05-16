import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserDialog } from "./UserDialog";
import { api } from "../lib/api";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn() },
}));

const mockApi = vi.mocked(api);

const EXISTING_USER = {
  id: "2",
  name: "Bob Agent",
  email: "bob@test.com",
  role: "AGENT" as const,
  createdAt: "2024-01-15T00:00:00Z",
};

function renderCreate(onClose = vi.fn()) {
  return renderWithQuery(<UserDialog open={true} onClose={onClose} />);
}

function renderEdit(user = EXISTING_USER, onClose = vi.fn()) {
  return renderWithQuery(<UserDialog user={user} open={true} onClose={onClose} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UserDialog — create mode", () => {
  describe("form validation", () => {
    it("shows all field errors when submitting an empty form", async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.click(screen.getByRole("button", { name: /create user/i }));

      expect(await screen.findByText("Name must be at least 3 characters")).toBeInTheDocument();
      expect(screen.getByText("A valid email is required")).toBeInTheDocument();
      expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it("marks all invalid fields with aria-invalid", async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.click(screen.getByRole("button", { name: /create user/i }));

      await screen.findByText("Name must be at least 3 characters");
      expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    });

    it("shows a password error when password is too short", async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.type(screen.getByLabelText("Name"), "Alice");
      await user.type(screen.getByLabelText("Email"), "alice@test.com");
      await user.type(screen.getByLabelText("Password"), "short");
      await user.click(screen.getByRole("button", { name: /create user/i }));

      expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
    });
  });

  describe("successful submission", () => {
    beforeEach(() => {
      mockApi.post.mockResolvedValue({
        id: "3",
        name: "Alice New",
        email: "alice@test.com",
        role: "AGENT",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("calls api.post with the submitted form data", async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.type(screen.getByLabelText("Name"), "Alice New");
      await user.type(screen.getByLabelText("Email"), "alice@test.com");
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: /create user/i }));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith("/users", {
          name: "Alice New",
          email: "alice@test.com",
          password: "password123",
        });
      });
    });

    it("calls onClose after successful submission", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderCreate(onClose);

      await user.type(screen.getByLabelText("Name"), "Alice New");
      await user.type(screen.getByLabelText("Email"), "alice@test.com");
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: /create user/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
  });

  describe("server errors", () => {
    it("sets an email field error when the server returns a duplicate email", async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue(new Error("A user with that email already exists"));
      renderCreate();

      await user.type(screen.getByLabelText("Name"), "Alice New");
      await user.type(screen.getByLabelText("Email"), "alice@test.com");
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: /create user/i }));

      expect(await screen.findByText("A user with that email already exists")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getAllByText("A user with that email already exists")).toHaveLength(1);
    });

    it("shows a banner for generic server errors", async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue(new Error("Internal server error"));
      renderCreate();

      await user.type(screen.getByLabelText("Name"), "Alice New");
      await user.type(screen.getByLabelText("Email"), "alice@test.com");
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: /create user/i }));

      expect(await screen.findByText("Internal server error")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("cancel", () => {
    it("calls onClose when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderCreate(onClose);

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
  });
});

describe("UserDialog — edit mode", () => {
  it("shows the title 'Edit user'", () => {
    renderEdit();
    expect(screen.getByText("Edit user")).toBeInTheDocument();
  });

  it("pre-populates name and email from the user prop", () => {
    renderEdit();
    expect(screen.getByLabelText("Name")).toHaveValue("Bob Agent");
    expect(screen.getByLabelText("Email")).toHaveValue("bob@test.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("calls api.patch with name and email when password is left blank", async () => {
    const user = userEvent.setup();
    mockApi.patch.mockResolvedValue({ ...EXISTING_USER, name: "Bob Updated" });
    renderEdit();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Bob Updated");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(`/users/${EXISTING_USER.id}`, {
        name: "Bob Updated",
        email: EXISTING_USER.email,
        password: undefined,
      });
    });
  });

  it("includes the password in the patch when provided", async () => {
    const user = userEvent.setup();
    mockApi.patch.mockResolvedValue(EXISTING_USER);
    renderEdit();

    await user.type(screen.getByLabelText("Password"), "newpassword123");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(`/users/${EXISTING_USER.id}`, expect.objectContaining({
        password: "newpassword123",
      }));
    });
  });

  it("shows a password error when an invalid password is entered", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(mockApi.patch).not.toHaveBeenCalled();
  });

  it("calls onClose after successful save", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockApi.patch.mockResolvedValue(EXISTING_USER);
    renderEdit(EXISTING_USER, onClose);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderEdit(EXISTING_USER, onClose);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
