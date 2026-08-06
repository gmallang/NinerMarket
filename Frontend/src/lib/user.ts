import type { CurrentUser } from "./types";

export const SCHOOL_YEARS = [
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Graduate",
  "Faculty / Staff",
] as const;

export const PAYMENT_METHODS = [
  "Cash",
  "Venmo",
  "Zelle",
  "PayPal",
  "Apple Pay",
  "Niner Cash",
] as const;

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
