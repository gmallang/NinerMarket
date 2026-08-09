import type {
  AuthResponse,
  ListingDto,
  NewListing,
  NewRating,
  NotificationDto,
  Rating,
  UserDto,
} from "./types";
import type { Conversation } from "@/data/conversations";

const BASE_URL: string = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");
const TOKEN_KEY = "ninermarket-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

  updateListing: (id: string, data: Partial<Omit<NewListing, "seller_id">>) =>
    request<ListingDto>(`/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  uploadPhoto: (dataUrl: string) =>
    request<{ url: string }>("/photos", {
      method: "POST",
      body: JSON.stringify({ data_url: dataUrl }),
    }).then((r) => r.url),

  createUser: (data: {
    id: string;
    email: string;
    display_name: string;
    password: string;
    school_year?: string;
    payment_methods?: string[];
  }) =>
    request<{ user: UserDto; dev_code?: string }>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyEmail: (email: string, code: string) =>
    request<AuthResponse>("/users/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  resendCode: (email: string) =>
    request<{ user: UserDto; dev_code?: string }>("/users/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/users/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  googleLogin: (idToken: string) =>
    request<AuthResponse>("/users/google", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    }),

  setPassword: (idToken: string, password: string) =>
    request<UserDto>("/users/password", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken, password }),
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

  markListingSold: (id: string) =>
    request<ListingDto>(`/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "sold" }),
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
