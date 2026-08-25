import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";

const mockApiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ warning: vi.fn() }),
}));

vi.mock("@/lib/socket", () => ({
  disconnectSocket: vi.fn(),
}));

import { AuthProvider, useAuth } from "@/lib/auth";

function AuthConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return <div data-testid="user">{user ? user.username : "no user"}</div>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockApiGet.mockReturnValueOnce(new Promise(() => {}));
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("sets user from /api/auth/me on mount", async () => {
    mockApiGet.mockResolvedValueOnce({
      user: { id: 1, username: "admin", role: "admin" },
      expiresAt: Date.now() + 3600000,
    });
    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("admin");
    });
  });

  it("sets 'no user' when /api/auth/me rejects", async () => {
    mockApiGet.mockRejectedValueOnce(new Error("Unauthorized"));
    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("no user");
    });
  });
});
