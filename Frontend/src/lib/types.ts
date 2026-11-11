export interface Seller {
  id: string;
  display_name: string;
  school_year?: string;
  payment_methods?: string[];
  rating_avg: number;
  rating_count: number;
}

export interface UserDto {
  id: string;
  email: string;
  display_name: string;
  school_year?: string;
  payment_methods?: string[];
  rating_avg: number;
  rating_count: number;
  email_verified?: boolean;
  has_password?: boolean;
  /** Set by the backend from its admin allow-list; also gates /admin. */
  is_admin?: boolean;
}

export interface AuthResponse {
  user: UserDto;
  token: string;
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
  flag_reason?: string;
  photos: string[];
  photos_small?: string[];
  pickup_location: string;
  created_at: string;
  sold_at?: string | null;
  seller: Seller | null;
}

export interface Listing {
  id: string;
  title: string;
  price: number;
  category: string;
  campus: string;
  time: string;
  createdAt: string;
  condition: string;
  image: string;
  thumbnail?: string;
  seller: string;
  sellerId?: string;
  sellerRating: number;
  sellerRatingCount?: number;
  sellerYear?: string;
  sellerPayments?: string[];
  description?: string;
  photos?: string[];
  status: string;
  flagReason?: string;
  soldAt?: string;
}

export interface Rating {
  id: string;
  rater_id: string;
  ratee_id: string;
  listing_id: string;
  stars: number;
  comment: string;
  created_at: string;
  rater?: { id: string; display_name: string } | null;
}

export interface NewRating {
  rater_id: string;
  ratee_id: string;
  listing_id: string;
  stars: number;
  comment: string;
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
  school_year?: string;
  payment_methods?: string[];
  email_verified?: boolean;
  has_password?: boolean;
  is_admin?: boolean;
}

export interface AdminListing extends ListingDto {
  report_count: number;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  school_year?: string;
  email_verified?: boolean;
  rating_avg: number;
  rating_count: number;
  is_admin: boolean;
  listing_count: number;
  /** When true, every new listing from this account waits for admin approval. */
  posting_flagged?: boolean;
  flag_reason?: string;
  bad_listing_streak?: number;
  /** Set when an admin closed the account; the Deleted tab can restore it. */
  deleted_at?: string | null;
}

export interface AdminReport {
  id: string;
  listing_id: string;
  reporter_id: string;
  reason: string;
  details: string;
  status: "open" | "dismissed" | "upheld";
  created_at: string;
  resolved_at?: string | null;
  reporter: { id: string; display_name: string; email?: string } | null;
  listing: { id: string; name: string; status: string; price?: number } | null;
}

export interface AdminAuditEntry {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  details: string;
  created_at: string;
}

export interface AdminRating {
  id: string;
  rater_id: string;
  ratee_id: string;
  listing_id: string;
  stars: number;
  comment: string;
  created_at: string;
  rater: { id: string; display_name: string } | null;
  ratee: { id: string; display_name: string } | null;
}

export type WantedRequestStatus = "active" | "fulfilled" | "expired";

export interface WantedRequestDto {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  budget_min: number | null;
  budget_max: number | null;
  preferred_location: string;
  photos: string[];
  status: WantedRequestStatus;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  requester: Seller | null;
  response_count: number;
}

export interface NewWantedRequest {
  title: string;
  category: string;
  description: string;
  budget_min?: number | null;
  budget_max?: number | null;
  preferred_location?: string;
  expires_at?: string | null;
}

export interface NotificationDto {
  id: string;
  user_id: string;
  text: string;
  listing_id?: string;
  related_user_id?: string;
  related_user_name?: string;
  created_at: string;
  read: boolean;
}

export type OfferStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface Offer {
  id: string;
  listing_id: string;
  listing_name: string;
  listing_price: number;
  listing_status?: string;
  buyer_id: string;
  buyer_name: string;
  price: number;
  status: OfferStatus;
  created_at: string;
  direction: "sent" | "received";
}
