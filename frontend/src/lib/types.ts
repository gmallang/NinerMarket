export interface Seller {
  id: string;
  display_name: string;
  rating_avg: number;
  rating_count: number;
}

export interface UserDto {
  id: string;
  email: string;
  display_name: string;
  rating_avg: number;
  rating_count: number;
}

export interface ListingDto {
  id: string;
  seller_id: string;
  name: string;
  price: number;
  category: string;
  condition: string;
  description: string;
  status: string;
  photos: string[];
  pickup_location: string;
  created_at: string;
  seller: Seller | null;
}

export interface Listing {
  id: string;
  title: string;
  price: number;
  category: string;
  campus: string;
  time: string;
  condition: string;
  image: string;
  seller: string;
  sellerId?: string;
  sellerRating: number;
  description?: string;
  photos?: string[];
}

export interface NewListing {
  seller_id: string;
  name: string;
  price: number;
  category: string;
  condition: string;
  description: string;
  pickup_location: string;
  photos?: string[];
}

export interface CurrentUser {
  id: string;
  email: string;
  display_name: string;
}

const USER_KEY = "ninermarket-user";

export function loadUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: CurrentUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore storage errors
  }
}

export function clearUser(): void {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore storage errors
  }
}

export function currentUserId(): string {
  return loadUser()?.id ?? "";
}

const PLACEHOLDER_IMG =
  "https://placehold.co/400x400/e8f5e9/1a7a3c?text=NinerMarket";

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
    description: d.description,
    photos: d.photos ?? [],
  };
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
