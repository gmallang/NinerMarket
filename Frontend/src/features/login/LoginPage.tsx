import { LandingPage } from "@/features/landing/LandingPage";
import type { CurrentUser } from "@/lib/types";

/**
 * /login renders the same public landing page as /about. The mandatory gate
 * lives in the router (PublicOnly here, RequireAuth on every app route), so
 * this page only needs to hand a successful sign-in back to the page wrapper.
 */
export function LoginPage({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
  return <LandingPage onAuthed={onAuthed} />;
}
