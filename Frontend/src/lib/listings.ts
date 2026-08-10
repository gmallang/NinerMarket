import type { Listing, ListingDto } from "./types";
import { formatRelativeTime } from "./format";

const PLACEHOLDER_IMG = "https://placehold.co/400x400/e8f5e9/1a7a3c?text=NinerMarket";

export function fromDto(d: ListingDto): Listing {
  return {
    id: d.id,
    title: d.name,
    price: d.price,
    category: d.category,
    campus: d.pickup_location,
    time: formatRelativeTime(d.created_at),
    condition: d.condition,
    image: d.photos?.[0] ?? PLACEHOLDER_IMG,
    seller: d.seller?.display_name ?? "Unknown seller",
    sellerId: d.seller?.id ?? d.seller_id,
    sellerRating: d.seller?.rating_avg ?? 0,
    sellerRatingCount: d.seller?.rating_count ?? 0,
    sellerYear: d.seller?.school_year,
    sellerPayments: d.seller?.payment_methods,
    description: d.description,
    photos: d.photos ?? [],
    status: d.status,
    flagReason: d.flag_reason,
    soldAt: d.sold_at ?? undefined,
  };
}
