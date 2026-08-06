import { api } from "@/lib/api";
import { saveUser } from "@/lib/user";
import type { CurrentUser } from "@/lib/types";

export function isCharlotteEmail(email: string): boolean {
  return /^[^\s@]+@charlotte\.edu$/.test(email.trim().toLowerCase());
}

export function makeUserId(email: string): string {
  return (
    "u-" +
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

export async function signInOrUp(
  mode: "signin" | "signup",
  name: string,
  email: string,
  schoolYear = "",
  payments: string[] = []
): Promise<CurrentUser> {
  const id = makeUserId(email);
  const normalized = email.trim().toLowerCase();
  const display_name = mode === "signup" ? name.trim() : normalized.split("@")[0];

  const profile: Partial<CurrentUser> = {};

  try {
    if (mode === "signup") {
      await api.createUser({
        id,
        email: normalized,
        display_name,
        school_year: schoolYear,
        payment_methods: payments,
      });
      profile.school_year = schoolYear;
      profile.payment_methods = payments;
    } else {
      const u = await api.getUser(id);
      profile.school_year = u.school_year;
      profile.payment_methods = u.payment_methods;
    }
  } catch {
    // Sign-in stays local if the backend is unavailable; listings load from the API separately.
  }

  const user: CurrentUser = { id, email: normalized, display_name, ...profile };
  saveUser(user);
  return user;
}
