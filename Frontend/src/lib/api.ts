import type {
  ListingDto,
  NewListing,
  NewRating,
  NotificationDto,
  Rating,
  UserDto,
} from "./types";
import type { Conversation } from "@/data/conversations";

const BASE_URL: string = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export interface ListParams {
  category?: string;
  min_price?: number;
  max_price?: number;
  status?: string;
}

export const api = {
  listListings: (params: ListParams = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.min_price != null) q.set("min_price", String(params.min_price));
    if (params.max_price != null) q.set("max_price", String(params.max_price));
    if (params.status) q.set("status", params.status);
    const qs = q.toString();
    return request<ListingDto[]>(`/listings${qs ? `?${qs}` : ""}`);
  },

  getListing: (id: string) => request<ListingDto>(`/listings/${id}`),

  createListing: (data: NewListing) =>
    request<ListingDto>("/listings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createUser: (data: {
    id: string;
    email: string;
    display_name: string;
    school_year?: string;
    payment_methods?: string[];
  }) =>
    request<UserDto>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateUser: (
    id: string,
    data: { display_name?: string; school_year?: string; payment_methods?: string[] }
  ) =>
    request<UserDto>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getUser: (id: string) => request<UserDto>(`/users/${id}`),

  getUserListings: (id: string, status = "active") =>
    request<ListingDto[]>(`/users/${id}/listings?status=${status}`),

  getRatings: (rateeId: string) => request<Rating[]>(`/ratings/${rateeId}`),

  createRating: (data: NewRating) =>
    request<Rating>("/ratings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createCheckout: (body: { listing_id: string; success_url: string; cancel_url: string }) =>
    request<{ url: string | null; mock: boolean; listing_id: string }>("/checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getNotifications: (userId: string) =>
    request<NotificationDto[]>(`/users/${userId}/notifications`),

  markNotificationRead: (userId: string, notificationId: string) =>
    request<NotificationDto>(`/users/${userId}/notifications/${notificationId}`, {
      method: "PATCH",
    }),

  getThreads: (userId: string) => request<Conversation[]>(`/users/${userId}/threads`),

  openThread: (userId: string, listingId: string) =>
    request<Conversation>(`/users/${userId}/threads`, {
      method: "POST",
      body: JSON.stringify({ listing_id: listingId }),
    }),

  sendThreadMessage: (userId: string, threadId: number, text: string) =>
    request<Conversation>(`/users/${userId}/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  markThreadRead: (userId: string, threadId: number) =>
    request<Conversation>(`/users/${userId}/threads/${threadId}/read`, {
      method: "PATCH",
    }),
};
