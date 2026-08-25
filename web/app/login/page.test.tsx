import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

const mockLogin = vi.fn();
const mockVerifyTotp = vi.fn();

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: mockLogin,
    verifyTotp: mockVerifyTotp,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h1>{children}</h1>,
}));

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders username and password fields", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("admin")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("renders a sign in button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("calls login with credentials on submit", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("admin"), "admin");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("admin", "password123");
    });
  });

  it("shows TOTP input when login returns requiresTotp", async () => {
    mockLogin.mockResolvedValueOnce({ requiresTotp: true, tempToken: "tok123" });
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("admin"), "admin");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
    });
  });

  it("displays error message on login failure", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("admin"), "admin");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it("prevents double submission", async () => {
    mockLogin.mockImplementation(() => new Promise((r) => setTimeout(r, 5000)));
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("admin"), "admin");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    const btn = screen.getByRole("button", { name: /sign in/i });
    await user.click(btn);
    await user.click(btn);
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });
});
