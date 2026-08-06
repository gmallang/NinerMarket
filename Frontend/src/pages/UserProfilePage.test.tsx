import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "@/lib/api";
import { useMarketStore } from "@/lib/store";
import type { ListingDto, Rating, UserDto } from "@/lib/types";
import { UserProfilePage } from "./UserProfilePage";

vi.mock("@/lib/api", () => ({
  api: {
    getUser: vi.fn(),
    getRatings: vi.fn(),
    getUserListings: vi.fn(),
    createRating: vi.fn(),
  },
}));

const PROFILE: UserDto = {
  id: "u-1",
  email: "seller-1@charlotte.edu",
  display_name: "Maya T.",
  school_year: "Senior",
  payment_methods: ["Cash", "Venmo"],
  rating_avg: 4.9,
  rating_count: 32,
};

const RATINGS: Rating[] = [
  {
    id: "r1",
    rater_id: "u-2",
    ratee_id: "u-1",
    listing_id: "1",
    stars: 5,
    comment: "Great!",
    created_at: new Date().toISOString(),
  },
  {
    id: "r2",
    rater_id: "u-3",
    ratee_id: "u-1",
    listing_id: "1",
    stars: 4,
    comment: "Good.",
    created_at: new Date().toISOString(),
  },
];

function makeListing(id: string, name: string): ListingDto {
  return {
    id,
    seller_id: "u-1",
    name,
    price: 10,
    category: "textbooks",
    condition: "Good",
    description: name,
    status: "active",
    photos: [],
    pickup_location: "North Campus",
    created_at: new Date().toISOString(),
    seller: null,
  };
}

function renderProfile() {
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter initialEntries={["/user/u-1"]}>
      <Routes>
        <Route path="/user/:id" element={<UserProfilePage />} />
      </Routes>
    </MemoryRouter>
  );
  return { ...result, user };
}

describe("UserProfilePage", () => {
  beforeEach(() => {
    vi.mocked(api.getUser).mockResolvedValue(PROFILE);
    vi.mocked(api.getRatings).mockResolvedValue(RATINGS);
    vi.mocked(api.getUserListings).mockResolvedValue([
      makeListing("1", "Chemistry Textbook"),
      makeListing("2", "Desk Lamp"),
      makeListing("3", "Mini Fridge"),
      makeListing("4", "Standing Desk"),
    ]);
    useMarketStore.setState({
      user: { id: "u-me", email: "me@charlotte.edu", display_name: "Me" },
      savedItems: new Set(),
    });
  });

  it("shows the profile header with rating count", async () => {
    renderProfile();
    expect(await screen.findByRole("heading", { name: "Maya T." })).toBeInTheDocument();
    expect(screen.getByText("32 ratings")).toBeInTheDocument();
    expect(screen.getByText("Senior")).toBeInTheDocument();
  });

  it("shows recent listings by default and all when toggled", async () => {
    const { user } = renderProfile();
    expect(await screen.findByText("Chemistry Textbook")).toBeInTheDocument();
    expect(screen.queryByText("Standing Desk")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("Standing Desk")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maya's listings (4)" })).toBeInTheDocument();
  });

  it("lists individual ratings", async () => {
    renderProfile();
    expect(await screen.findByText("Great!")).toBeInTheDocument();
    expect(screen.getByText("Good.")).toBeInTheDocument();
  });

  it("lets a logged-in user submit a rating", async () => {
    vi.mocked(api.createRating).mockResolvedValue({
      id: "r3",
      rater_id: "u-me",
      ratee_id: "u-1",
      listing_id: "1",
      stars: 5,
      comment: "Superb!",
      created_at: new Date().toISOString(),
    });
    const { user } = renderProfile();
    await user.click(await screen.findByRole("button", { name: "5 stars" }));
    await user.type(screen.getByPlaceholderText("What was your experience like?"), "Superb!");
    await user.click(screen.getByRole("button", { name: "Submit rating" }));
    expect(api.createRating).toHaveBeenCalledWith(
      expect.objectContaining({ rater_id: "u-me", ratee_id: "u-1", stars: 5, comment: "Superb!" })
    );
    expect(await screen.findByText(/Thanks — your rating was submitted/)).toBeInTheDocument();
  });
});
