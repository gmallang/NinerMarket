import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/utils";
import { LoginPage } from "./LoginPage";

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as unknown as { google?: unknown }).google;
});

describe("LoginPage", () => {
  it("renders the auth card over the hero", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    renderWithRouter(<LoginPage />);
    expect(
      screen.getByRole("heading", { name: "Discover your campus marketplace" })
    ).toBeInTheDocument();
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(screen.getByText(/UNC Charlotte students, faculty/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New to NinerMarket/ })).toBeInTheDocument();
  });

  it("switches the card to the log-in form from the card's switch link", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    const { user } = renderWithRouter(<LoginPage />);

    expect(screen.queryByText("Forgot password?")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Log in" })[0]);
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
  });

  it("renders the Google Identity button when a client id is configured", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    const initialize = vi.fn();
    const renderButton = vi.fn();
    (window as unknown as { google: unknown }).google = {
      accounts: { id: { initialize, renderButton } },
    };

    renderWithRouter(<LoginPage />);

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "test-client-id.apps.googleusercontent.com",
        hd: "charlotte.edu",
      })
    );
    expect(renderButton).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid email with a field-level warning", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    const { user } = renderWithRouter(<LoginPage />);
    const emailInput = screen.getByPlaceholderText("Email address (@charlotte.edu)");
    await user.type(emailInput, "anna@gmail.com");
    expect(screen.getByText(/Must be a @charlotte.edu email/)).toBeInTheDocument();
  });
});
