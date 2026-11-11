import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/utils";
import { LoginPage } from "./LoginPage";

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as unknown as { google?: unknown }).google;
});

describe("LoginPage", () => {
  it("renders the split-screen login with the sign-in card", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    renderWithRouter(<LoginPage />);

    expect(screen.getByRole("heading", { level: 1, name: /Your Campus/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Log in to NinerMarket" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email address (@charlotte.edu)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new account" })).toBeInTheDocument();
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
  });

  it("switches to registration and back", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    const { user } = renderWithRouter(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Create new account" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Full name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByRole("heading", { name: "Log in to NinerMarket" })).toBeInTheDocument();
  });

  it("opens password recovery from the card", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    const { user } = renderWithRouter(<LoginPage />);

    await user.click(screen.getByText("Forgot password?"));
    expect(await screen.findByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  });

  it("renders the Google Identity button when a client id is configured", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    const initialize = vi.fn();
    const renderButton = vi.fn();
    (window as unknown as { google: unknown }).google = {
      accounts: { id: { initialize, renderButton } },
    };

    renderWithRouter(<LoginPage />);

    await waitFor(() => expect(initialize).toHaveBeenCalled());
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "test-client-id.apps.googleusercontent.com",
        hd: "charlotte.edu",
      })
    );
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
  });

  it("rejects an invalid email with a field-level warning", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    const { user } = renderWithRouter(<LoginPage />);

    const emailInput = screen.getByPlaceholderText("Email address (@charlotte.edu)");
    await user.type(emailInput, "anna@gmail.com");
    expect(screen.getByText(/Must be a @charlotte.edu email/)).toBeInTheDocument();
  });
});
