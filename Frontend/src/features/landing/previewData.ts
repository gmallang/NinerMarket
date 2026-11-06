import type { Listing, WantedRequestDto } from "@/lib/types";

/** Sample listings for the decorative hero preview. Static so the pitch looks
 * the same on every visit, independent of what the live API returns. */
/** A flat brand tile rather than a stock photo: this preview is a mock, and
 * generic stock photography of other people's items competed with the actual
 * product. Generated inline, so it also costs no request. */
const tile = (label: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">` +
      `<rect width="640" height="640" fill="#e4f2ea"/>` +
      `<text x="320" y="320" dy="0.35em" text-anchor="middle" ` +
      `font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" ` +
      `fill="#27805a">${label}</text></svg>`
  )}`;

export const PREVIEW_LISTINGS: Listing[] = [
  {
    id: "preview-biology",
    title: "Campbell Biology, 12th Edition",
    price: 55,
    category: "textbooks",
    campus: "North Campus",
    time: "2h ago",
    createdAt: "2026-11-04T09:00:00.000Z",
    condition: "Like New",
    image: tile("Textbooks"),
    thumbnail: tile("Textbooks"),
    seller: "Maya T.",
    sellerId: "preview-maya",
    sellerRating: 4.9,
    sellerRatingCount: 32,
    status: "active",
  },
  {
    id: "preview-sofa",
    title: "Green Velvet Sofa",
    price: 140,
    category: "furniture",
    campus: "South Village",
    time: "4h ago",
    createdAt: "2026-11-04T07:00:00.000Z",
    condition: "Excellent",
    image: tile("Furniture"),
    thumbnail: tile("Furniture"),
    seller: "Jordan K.",
    sellerId: "preview-jordan",
    sellerRating: 4.8,
    sellerRatingCount: 18,
    status: "active",
  },
  {
    id: "preview-camera",
    title: "Canon EOS R Camera Kit",
    price: 420,
    category: "electronics",
    campus: "Main Campus",
    time: "6h ago",
    createdAt: "2026-11-04T05:00:00.000Z",
    condition: "Like New",
    image: tile("Cameras"),
    thumbnail: tile("Cameras"),
    seller: "Chris L.",
    sellerId: "preview-chris",
    sellerRating: 4.6,
    sellerRatingCount: 27,
    status: "active",
  },
  {
    id: "preview-lamp",
    title: "IKEA Desk Lamp",
    price: 16,
    category: "furniture",
    campus: "East Campus",
    time: "8h ago",
    createdAt: "2026-11-04T03:00:00.000Z",
    condition: "Good",
    image: tile("Lighting"),
    thumbnail: tile("Lighting"),
    seller: "Sam R.",
    sellerId: "preview-sam",
    sellerRating: 5,
    sellerRatingCount: 11,
    status: "active",
  },
  {
    id: "preview-keyboard",
    title: "Mechanical Keyboard, White",
    price: 45,
    category: "electronics",
    campus: "Main Campus",
    time: "Yesterday",
    createdAt: "2026-11-03T18:00:00.000Z",
    condition: "Excellent",
    image: tile("Keyboards"),
    thumbnail: tile("Keyboards"),
    seller: "Priya N.",
    sellerId: "preview-priya",
    sellerRating: 4.7,
    sellerRatingCount: 9,
    status: "active",
  },
  {
    id: "preview-basketball",
    title: "Spalding Basketball",
    price: 12,
    category: "other",
    campus: "Rec Center",
    time: "Yesterday",
    createdAt: "2026-11-03T15:00:00.000Z",
    condition: "Good",
    image: tile("Sports"),
    thumbnail: tile("Sports"),
    seller: "Devon B.",
    sellerId: "preview-devon",
    sellerRating: 4.5,
    sellerRatingCount: 6,
    status: "active",
  },
];

/** Sample wanted requests for the public "Ask for what you need" column. */
export const PREVIEW_REQUESTS: WantedRequestDto[] = [
  {
    id: "preview-chem-manual",
    user_id: "preview-jordan",
    title: "CHEM 1251 lab manual",
    description: "Any edition works - just need it before the first lab.",
    category: "textbooks",
    budget_min: 20,
    budget_max: 25,
    preferred_location: "North Campus",
    photos: [],
    status: "active",
    expires_at: null,
    created_at: "2026-11-04T14:00:00.000Z",
    updated_at: "2026-11-04T14:00:00.000Z",
    requester: {
      id: "preview-jordan",
      display_name: "Jordan K.",
      rating_avg: 4.8,
      rating_count: 18,
    },
    response_count: 3,
  },
];

/** A short, static conversation for the public "Message and meet up" column. */
export const PREVIEW_CHAT = {
  name: "Jordan K.",
  messages: [
    { text: "Is the sofa still available?", sent: false, time: "2:48 PM" },
    { text: "Yes! Meet at the Union at 3:30?", sent: true, time: "2:51 PM" },
  ],
};
