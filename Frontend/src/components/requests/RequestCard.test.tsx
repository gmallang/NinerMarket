import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WantedRequestDto } from "@/lib/types";
import { renderWithRouter } from "@/test/utils";
import { RequestCard } from "./RequestCard";

const REQUEST: WantedRequestDto = {
  id: "req-1",
  user_id: "u-1",
  title: "Mini Fridge for My Dorm",
  description: "Need one before move-in, anything 3 cu ft or larger.",
  category: "movein",
  budget_min: 40,
  budget_max: 60,
  preferred_location: "UNC Charlotte Campus",
  photos: [],
  status: "active",
  expires_at: "2026-12-01T00:00:00.000Z",
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  requester: {
    id: "u-1",
    display_name: "Nadia W.",
    rating_avg: 4.8,
    rating_count: 11,
  },
  response_count: 0,
};

describe("RequestCard", () => {
  it("shows the request details and offers a respond action to other users", () => {
    renderWithRouter(
      <RequestCard request={REQUEST} currentUserId="someone-else" onRespond={() => {}} />
    );

    expect(screen.getByText("Mini Fridge for My Dorm")).toBeInTheDocument();
    expect(screen.getByText("Budget $40 – $60")).toBeInTheDocument();
    expect(screen.getByText("UNC Charlotte Campus")).toBeInTheDocument();
    expect(screen.getByText("Nadia W.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I have this" })).toBeInTheDocument();
  });

  it("hides the respond action on your own request", () => {
    renderWithRouter(<RequestCard request={REQUEST} currentUserId="u-1" />);

    expect(screen.queryByRole("button", { name: "I have this" })).not.toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("only offers respond while the request is active", () => {
    renderWithRouter(
      <RequestCard
        request={{ ...REQUEST, status: "fulfilled" }}
        currentUserId="someone-else"
      />
    );

    expect(screen.getByText("Fulfilled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "I have this" })).not.toBeInTheDocument();
  });

  it("calls back when responding", async () => {
    const onRespond = vi.fn();
    const { user } = renderWithRouter(
      <RequestCard request={REQUEST} currentUserId="someone-else" onRespond={onRespond} />
    );

    await user.click(screen.getByRole("button", { name: "I have this" }));
    expect(onRespond).toHaveBeenCalledTimes(1);
  });
});
