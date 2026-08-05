import type { ListingDto, NewListing } from "./types";

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
};
