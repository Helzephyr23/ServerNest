import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/dashboard",
}));
vi.mock("next/link", () => {
  const Link = ({ children, ...props }: any) => <a {...props}>{children}</a>;
  return { default: Link };
});

vi.mock("@/components/error-boundary", () => ({
  ErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/confirm-dialog", () => ({
  ConfirmProvider: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/sidebar", () => ({
  default: () => <nav>Sidebar</nav>,
}));

let mockUser: { id: number; username: string; role: string } | null = null;
let mockLoading = false;

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: mockUser, loading: mockLoading }),
}));

import DashboardLayout from "@/app/dashboard/layout";

describe("DashboardLayout AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockLoading = false;
  });

  it("redirects to /login when user is null and not loading", () => {
    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>
    );
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("shows loading when loading is true", () => {
    mockLoading = true;
    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>
    );
    expect(screen.getByText("Connecting to control plane...")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders children when user is authenticated", () => {
    mockUser = { id: 1, username: "admin", role: "admin" };
    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});