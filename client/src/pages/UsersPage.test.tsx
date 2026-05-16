import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsersPage from "./UsersPage";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn() },
}));

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));

// Radix Select doesn't work in jsdom — replace with a native <select>
vi.mock("../components/ui/select", () => ({
  Select: ({ value, onValueChange, children, disabled }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
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
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const mockApi = vi.mocked(api);
const mockUseAuth = vi.mocked(useAuth);

const ADMIN: ReturnType<typeof makeUser> = makeUser("1", "Alice Admin", "alice@test.com", "ADMIN");
const AGENT: ReturnType<typeof makeUser> = makeUser("2", "Bob Agent", "bob@test.com", "AGENT");

function makeUser(id: string, name: string, email: string, role: "ADMIN" | "AGENT") {
  return {
    id, name, email, role,
    emailVerified: true,
    image: null,
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
  };
}

function renderPage(currentUser = ADMIN) {
  mockUseAuth.mockReturnValue({
    user: currentUser,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  } as ReturnType<typeof useAuth>);

  return renderWithQuery(<UsersPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UsersPage", () => {
  describe("loading state", () => {
    it("renders skeleton rows while fetching", () => {
      mockApi.get.mockReturnValue(new Promise(() => {}));
      renderPage();
      // 5 skeleton rows × 3 skeleton cells each = 15 skeletons
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("empty state", () => {
    it("shows empty message when no users are returned", async () => {
      mockApi.get.mockResolvedValue([]);
      renderPage();
      expect(await screen.findByText("No users found.")).toBeInTheDocument();
    });
  });

  describe("user list", () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue([ADMIN, AGENT]);
    });

    it("renders each user's name and email", async () => {
      renderPage();
      expect(await screen.findByText("Alice Admin")).toBeInTheDocument();
      expect(screen.getByText("alice@test.com")).toBeInTheDocument();
      expect(screen.getByText("Bob Agent")).toBeInTheDocument();
      expect(screen.getByText("bob@test.com")).toBeInTheDocument();
    });

    it("marks the current user's row with '(you)'", async () => {
      renderPage(ADMIN);
      expect(await screen.findByText("(you)")).toBeInTheDocument();
    });

    it("shows a static role badge instead of a select for the current user", async () => {
      renderPage(ADMIN);
      await screen.findByText("Alice Admin");
      // Current user row has a Badge, not a Select trigger
      const aliceRow = screen.getByText("Alice Admin").closest("tr")!;
      expect(within(aliceRow).getByText("ADMIN")).toBeInTheDocument();
      expect(within(aliceRow).queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("shows a role select for other users", async () => {
      renderPage(ADMIN);
      await screen.findByText("Bob Agent");
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      expect(within(bobRow).getByRole("combobox")).toBeInTheDocument();
    });

    it("does not show a delete button for the current user", async () => {
      renderPage(ADMIN);
      await screen.findByText("Alice Admin");
      const aliceRow = screen.getByText("Alice Admin").closest("tr")!;
      expect(within(aliceRow).queryByRole("button")).not.toBeInTheDocument();
    });

    it("shows a delete button for other users", async () => {
      renderPage(ADMIN);
      await screen.findByText("Bob Agent");
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      expect(within(bobRow).getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe("role change", () => {
    it("calls api.patch with the new role when the select changes", async () => {
      const user = userEvent.setup();
      mockApi.get.mockResolvedValue([ADMIN, AGENT]);
      mockApi.patch.mockResolvedValue({ ...AGENT, role: "ADMIN" });
      renderPage(ADMIN);

      await screen.findByText("Bob Agent");
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      const select = within(bobRow).getByRole("combobox");

      await user.selectOptions(select, "ADMIN");

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith("/users/2/role", { role: "ADMIN" });
      });
    });

    it("shows an error message when the role update fails", async () => {
      const user = userEvent.setup();
      mockApi.get.mockResolvedValue([ADMIN, AGENT]);
      mockApi.patch.mockRejectedValue(new Error("Failed to update role"));
      renderPage(ADMIN);

      await screen.findByText("Bob Agent");
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      const select = within(bobRow).getByRole("combobox");

      await user.selectOptions(select, "ADMIN");

      expect(await screen.findByText("Failed to update role")).toBeInTheDocument();
    });
  });

  describe("delete user", () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue([ADMIN, AGENT]);
    });

    it("opens a confirmation dialog when delete is clicked", async () => {
      const user = userEvent.setup();
      renderPage(ADMIN);

      await screen.findByText("Bob Agent");
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      await user.click(within(bobRow).getByRole("button", { name: /delete/i }));

      expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
      expect(screen.getByText("Bob Agent", { selector: "strong" })).toBeInTheDocument();
    });

    it("calls api.delete and removes the user when confirmed", async () => {
      const user = userEvent.setup();
      mockApi.delete.mockResolvedValue(undefined);
      renderPage(ADMIN);

      await screen.findByText("Bob Agent");
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      await user.click(within(bobRow).getByRole("button", { name: /delete/i }));

      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        expect(mockApi.delete).toHaveBeenCalledWith("/users/2");
      });
      await waitFor(() => {
        expect(screen.queryByText("Bob Agent")).not.toBeInTheDocument();
      });
    });

    it("does not call api.delete when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderPage(ADMIN);

      await screen.findByText("Bob Agent");
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      await user.click(within(bobRow).getByRole("button", { name: /delete/i }));

      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: /cancel/i }));

      expect(mockApi.delete).not.toHaveBeenCalled();
    });

    it("shows an error message when deletion fails", async () => {
      const user = userEvent.setup();
      mockApi.delete.mockRejectedValue(new Error("Failed to delete user"));
      renderPage(ADMIN);

      await screen.findByText("Bob Agent");
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      await user.click(within(bobRow).getByRole("button", { name: /delete/i }));

      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

      expect(await screen.findByText("Failed to delete user")).toBeInTheDocument();
    });
  });

  describe("fetch error", () => {
    it("shows an error message when the user list fails to load", async () => {
      mockApi.get.mockRejectedValue(new Error("Network error"));
      renderPage();
      expect(await screen.findByText("Network error")).toBeInTheDocument();
    });
  });
});
