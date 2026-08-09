import { api, setToken } from "@/lib/api";
import { saveUser } from "@/lib/user";
import type { CurrentUser } from "@/lib/types";

export function isCharlotteEmail(email: string): boolean {
  return /^[^\s@]+@charlotte\.edu$/.test(email.trim().toLowerCase());
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0];
  const pretty = local
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return pretty || local;
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

export interface SignupResult {
  user: CurrentUser;
  devCode?: string;
  needsVerification: boolean;
}

export async function signup(
  name: string,
  email: string,
  password: string,
  schoolYear: string,
  payments: string[]
): Promise<SignupResult> {
  const id = makeUserId(email);
  const normalized = email.trim().toLowerCase();
  const res = await api.createUser({
    id,
    email: normalized,
    display_name: name.trim(),
    password,
    school_year: schoolYear,
    payment_methods: payments,
  });
  return {
    user: res.user,
    devCode: res.dev_code,
    needsVerification: !res.user.email_verified,
  };
}

export async function verifyEmail(email: string, code: string): Promise<CurrentUser> {
  const res = await api.verifyEmail(email.trim().toLowerCase(), code);
  setToken(res.token);
  saveUser(res.user);
  return res.user;
}

export async function signin(email: string, password: string): Promise<CurrentUser> {
  const res = await api.login(email.trim().toLowerCase(), password);
  setToken(res.token);
  saveUser(res.user);
  return res.user;
}

export async function signInWithGoogleToken(idToken: string): Promise<CurrentUser> {
  const res = await api.googleLogin(idToken);
  setToken(res.token);
  saveUser(res.user);
  return res.user;
}

export async function loadSessionUser(): Promise<CurrentUser> {
  const user = await api.getMe();
  saveUser(user);
  return user;
}

export async function signInWithGoogle(email: string): Promise<CurrentUser> {
  const id = makeUserId(email);
  const normalized = email.trim().toLowerCase();
  try {
    const u = await api.getUser(id);
    const user: CurrentUser = {
      id,
      email: normalized,
      display_name: u.display_name,
      school_year: u.school_year,
      payment_methods: u.payment_methods,
      email_verified: u.email_verified ?? true,
    };
    saveUser(user);
    return user;
  } catch {
    return localSignIn(normalized, nameFromEmail(normalized));
  }
}

export function localSignIn(email: string, displayName: string): CurrentUser {
  const user: CurrentUser = {
    id: makeUserId(email),
    email: email.trim().toLowerCase(),
    display_name: displayName,
    email_verified: true,
  };
  saveUser(user);
  return user;
}
