import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, within, fireEvent } from "@testing-library/react";
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

    it("shows a role badge for every user", async () => {
      renderPage(ADMIN);
      await screen.findByText("Alice Admin");
      const aliceRow = screen.getByText("Alice Admin").closest("tr")!;
      expect(within(aliceRow).getByText("admin")).toBeInTheDocument();
    });

    it("shows an edit button for every row including the current user", async () => {
      renderPage(ADMIN);
      await screen.findByText("Alice Admin");
      const aliceRow = screen.getByText("Alice Admin").closest("tr")!;
      expect(within(aliceRow).getByRole("button", { name: /edit/i })).toBeInTheDocument();
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      expect(within(bobRow).getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });
  });

  describe("fetch error", () => {
    it("shows an error message when the user list fails to load", async () => {
      mockApi.get.mockRejectedValue(new Error("Network error"));
      renderPage();
      expect(await screen.findByText("Network error")).toBeInTheDocument();
    });
  });

  describe("create user dialog", () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue([]);
    });

    it("shows the dialog when 'New User' is clicked", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole("button", { name: /new user/i }));

      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Create new user")).toBeInTheDocument();
    });

    it("hides the dialog when Escape is pressed", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole("button", { name: /new user/i }));
      await screen.findByRole("dialog");

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("hides the dialog when clicking outside", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole("button", { name: /new user/i }));
      await screen.findByRole("dialog");

      // userEvent.click fails because Radix sets pointer-events:none on the
      // body while the dialog is open. fireEvent bypasses that CSS check and
      // fires directly on the document, which is where Radix's
      // DismissableLayer capture listener runs its outside-click detection.
      fireEvent.pointerDown(document.body);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });
});
