import { describe, expect, it } from "vitest";
import type { ListingDto } from "./types";
import { fromDto } from "./listings";

function makeDto(overrides: Partial<ListingDto> = {}): ListingDto {
  return {
    id: "1",
    seller_id: "u-1",
    name: "Desk Lamp",
    price: 18,
    category: "movein",
    condition: "Like New",
    description: "Adjustable LED lamp",
    status: "active",
    photos: ["https://example.com/photo.jpg"],
    pickup_location: "North Campus",
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    seller: null,
    ...overrides,
  };
}

describe("fromDto", () => {
  it("maps a listing DTO to a Listing", () => {
    const dto = makeDto({
      seller: {
        id: "u-1",
        display_name: "Nadia W.",
        school_year: "Junior",
        payment_methods: ["Venmo"],
        rating_avg: 4.8,
        rating_count: 12,
      },
    });
    const listing = fromDto(dto);
    expect(listing.id).toBe("1");
    expect(listing.title).toBe("Desk Lamp");
    expect(listing.price).toBe(18);
    expect(listing.category).toBe("movein");
    expect(listing.campus).toBe("North Campus");
    expect(listing.condition).toBe("Like New");
    expect(listing.image).toBe("https://example.com/photo.jpg");
    expect(listing.seller).toBe("Nadia W.");
    expect(listing.sellerId).toBe("u-1");
    expect(listing.sellerRating).toBe(4.8);
    expect(listing.sellerRatingCount).toBe(12);
    expect(listing.sellerYear).toBe("Junior");
    expect(listing.sellerPayments).toEqual(["Venmo"]);
  });

  it("falls back to a placeholder image and unknown seller", () => {
    const listing = fromDto(makeDto({ photos: [] }));
    expect(listing.image).toMatch(/placehold\.co/);
    expect(listing.seller).toBe("Unknown seller");
    expect(listing.sellerId).toBe("u-1");
    expect(listing.sellerRating).toBe(0);
  });
});
