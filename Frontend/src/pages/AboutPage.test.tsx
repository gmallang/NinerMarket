import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/utils";
import { AboutPage } from "./AboutPage";

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as unknown as { google?: unknown }).google;
});

describe("AboutPage", () => {
  it("renders the gated login page without marketplace content", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    renderWithRouter(<AboutPage />);

    expect(screen.getByRole("heading", { level: 1, name: /Your Campus/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Log in to NinerMarket" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email address (@charlotte.edu)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new account" })).toBeInTheDocument();

    expect(screen.queryByText("Recently Listed")).not.toBeInTheDocument();
    expect(screen.queryByText("Looking For?")).not.toBeInTheDocument();
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
  });

  it("renders the Google Identity button when a client id is configured", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    const initialize = vi.fn();
    const renderButton = vi.fn();
    (window as unknown as { google: unknown }).google = {
      accounts: { id: { initialize, renderButton } },
    };

    renderWithRouter(<AboutPage />);

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
    const { user } = renderWithRouter(<AboutPage />);

    const emailInput = screen.getByPlaceholderText("Email address (@charlotte.edu)");
    await user.type(emailInput, "anna@gmail.com");
    expect(screen.getByText(/Must be a @charlotte.edu email/)).toBeInTheDocument();
  });
});
