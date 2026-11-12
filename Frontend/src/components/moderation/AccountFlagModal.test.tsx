import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AccountFlagModal } from "./AccountFlagModal";
import { useMarketStore } from "@/lib/store";
import type { CurrentUser } from "@/lib/types";

const baseUser: CurrentUser = {
  id: "u-flag-modal",
  email: "flag-modal@charlotte.edu",
  display_name: "Flag Modal",
  email_verified: true,
};

function setUser(user: CurrentUser | null) {
  useMarketStore.setState({ user });
}

afterEach(() => {
  cleanup();
  setUser(null);
});

describe("AccountFlagModal", () => {
  it("renders nothing for an account that is not in review", () => {
    setUser(baseUser);
    render(<AccountFlagModal open onOpenChange={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays closed when open is false", () => {
    setUser({ ...baseUser, posting_flagged: true });
    render(<AccountFlagModal open={false} onOpenChange={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lists every restriction the flagged account runs into", () => {
    setUser({ ...baseUser, posting_flagged: true });
    render(<AccountFlagModal open onOpenChange={() => {}} />);

    expect(screen.getByText(/your account is under review/i)).toBeInTheDocument();
    expect(screen.getByText(/what you can't do right now/i)).toBeInTheDocument();
    expect(screen.getByText(/show a new listing to other students/i)).toBeInTheDocument();
    expect(screen.getByText(/put a held post live yourself/i)).toBeInTheDocument();
    expect(screen.getByText(/what still works normally/i)).toBeInTheDocument();
  });

  it("shows the moderator's reason and hides the row when none was recorded", () => {
    setUser({ ...baseUser, posting_flagged: true, flag_reason: "Repeated spam" });
    render(<AccountFlagModal open onOpenChange={() => {}} />);
    expect(screen.getByText(/reason on file:/i)).toHaveTextContent("Repeated spam");

    cleanup();
    setUser({ ...baseUser, posting_flagged: true, flag_reason: "" });
    render(<AccountFlagModal open onOpenChange={() => {}} />);
    expect(screen.queryByText(/reason on file:/i)).toBeNull();
  });

  it("closes from the acknowledge button and the corner control", () => {
    const onOpenChange = vi.fn();
    setUser({ ...baseUser, posting_flagged: true });
    render(<AccountFlagModal open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: /close notice/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("offers an appeal route to the moderators", () => {
    setUser({ ...baseUser, posting_flagged: true });
    render(<AccountFlagModal open onOpenChange={() => {}} />);

    const mails = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(mails).toContain("mailto:gmallang@charlotte.edu");
    expect(mails).toContain("mailto:ksaifeld@charlotte.edu");
  });
});
