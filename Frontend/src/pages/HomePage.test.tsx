import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Listing } from "@/lib/types";
import { useMarketStore } from "@/lib/store";
import { renderWithRouter } from "@/test/utils";
import { HomePage } from "./HomePage";

const LISTINGS: Listing[] = [
  {
    id: "1",
    title: "Organic Chemistry (Clayden) 2nd Ed.",
    price: 45,
    category: "textbooks",
    campus: "North Campus",
    time: "2h ago",
    condition: "Good",
    image: "https://example.com/chem.jpg",
    seller: "Maya T.",
    sellerId: "u1",
    sellerRating: 4.9,
  },
  {
    id: "2",
    title: "IKEA KALLAX Shelf Unit (White)",
    price: 35,
    category: "furniture",
    campus: "West Dorms",
    time: "5h ago",
    condition: "Like New",
    image: "https://example.com/kallax.jpg",
    seller: "Jordan K.",
    sellerId: "u2",
    sellerRating: 5,
  },
  {
    id: "4",
    title: 'MacBook Pro 14" M2 (2023)',
    price: 1100,
    category: "electronics",
    campus: "Main Quad",
    time: "3h ago",
    condition: "Excellent",
    image: "https://example.com/mbp.jpg",
    seller: "Chris L.",
    sellerId: "u4",
    sellerRating: 4.8,
  },
];

describe("HomePage", () => {
  beforeEach(() => {
    useMarketStore.setState({
      listings: LISTINGS,
      loading: false,
      listingsError: null,
      savedItems: new Set(),
    });
  });

  it("renders the listing grid", () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByRole("heading", { name: "All Categories" })).toBeInTheDocument();
    expect(screen.getByText("Organic Chemistry (Clayden) 2nd Ed.")).toBeInTheDocument();
    expect(screen.getByText('MacBook Pro 14" M2 (2023)')).toBeInTheDocument();
  });

  it("shows the loading state while listings are pending", () => {
    useMarketStore.setState({ listings: [], loading: true });
    renderWithRouter(<HomePage />);
    expect(screen.getByText("Loading listings...")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    useMarketStore.setState({ listings: [] });
    renderWithRouter(<HomePage />);
    expect(screen.getByText("No listings found")).toBeInTheDocument();
  });

  it("shows only saved listings for the saved view", () => {
    useMarketStore.setState({ savedItems: new Set(["2"]) });
    renderWithRouter(<HomePage />, "/?saved=1");
    expect(screen.getByRole("heading", { name: "Saved Items" })).toBeInTheDocument();
    expect(screen.getByText("IKEA KALLAX Shelf Unit (White)")).toBeInTheDocument();
    expect(screen.queryByText('MacBook Pro 14" M2 (2023)')).not.toBeInTheDocument();
    expect(screen.getByText("1 saved item")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is saved yet", () => {
    renderWithRouter(<HomePage />, "/?saved=1");
    expect(screen.getByText("No saved items yet")).toBeInTheDocument();
  });

  it("shows only the current user's listings for the mine view", () => {
    useMarketStore.setState({
      listings: [
        { ...LISTINGS[0], sellerId: "u1" },
        { ...LISTINGS[1], sellerId: "u2" },
      ],
      user: { id: "u1", email: "a@uncc.edu", display_name: "Maya T." },
    });
    renderWithRouter(<HomePage />, "/?mine=1");
    expect(screen.getByRole("heading", { name: "Your Listings" })).toBeInTheDocument();
    expect(screen.getByText("Organic Chemistry (Clayden) 2nd Ed.")).toBeInTheDocument();
    expect(screen.queryByText("IKEA KALLAX Shelf Unit (White)")).not.toBeInTheDocument();
    expect(screen.getByText("1 active listing")).toBeInTheDocument();
  });

  it("shows an error banner with retry when listings fail to load", () => {
    useMarketStore.setState({ listings: [], listingsError: "Failed to fetch" });
    renderWithRouter(<HomePage />);
    expect(screen.getByText(/Couldn't load listings/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
