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
  sellerRatingCount?: number;
  sellerYear?: string;
  sellerPayments?: string[];
  description?: string;
  photos?: string[];
  status: string;
  flagReason?: string;
}

export interface Rating {
  id: string;
  rater_id: string;
  ratee_id: string;
  listing_id: string;
  stars: number;
  comment: string;
  created_at: string;
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
}

export interface NotificationDto {
  id: string;
  user_id: string;
  text: string;
  listing_id?: string;
  created_at: string;
  read: boolean;
}
