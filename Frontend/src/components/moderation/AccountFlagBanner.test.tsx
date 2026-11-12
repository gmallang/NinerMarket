import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AccountFlagBanner } from "./AccountFlagBanner";
import { useMarketStore } from "@/lib/store";
import type { CurrentUser } from "@/lib/types";

const baseUser: CurrentUser = {
  id: "u-flag-banner",
  email: "flag-banner@charlotte.edu",
  display_name: "Flag Banner",
  email_verified: true,
};

function setUser(user: CurrentUser | null) {
  useMarketStore.setState({ user });
}

afterEach(() => {
  cleanup();
  setUser(null);
});

describe("AccountFlagBanner", () => {
  it("stays hidden for an account that is not in review", () => {
    setUser(baseUser);
    render(<AccountFlagBanner />);
    expect(screen.queryByText(/account is in review/i)).toBeNull();
  });

  it("shows the moderator's reason and what changes for the user", () => {
    setUser({ ...baseUser, posting_flagged: true, flag_reason: "Repeated spam" });
    render(<AccountFlagBanner />);

    expect(screen.getByText(/account is in review/i)).toBeInTheDocument();
    expect(screen.getByText(/Reason on file:/i)).toHaveTextContent("Repeated spam");
    expect(screen.getByText(/until a moderator approves them/i)).toBeInTheDocument();
  });

  it("still explains the restriction when no reason was recorded", () => {
    setUser({ ...baseUser, posting_flagged: true, flag_reason: "" });
    render(<AccountFlagBanner />);

    expect(screen.getByText(/account is in review/i)).toBeInTheDocument();
    expect(screen.queryByText(/Reason on file:/i)).toBeNull();
  });

  it("can be dismissed for the current visit", () => {
    setUser({ ...baseUser, posting_flagged: true, flag_reason: "Repeated spam" });
    render(<AccountFlagBanner />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss for now/i }));

    expect(screen.queryByText(/account is in review/i)).toBeNull();
  });
});
