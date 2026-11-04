import { useNavigate } from "react-router-dom";
import { LandingPage } from "@/features/landing/LandingPage";
import { useMarketStore } from "@/lib/store";
import type { CurrentUser } from "@/lib/types";

export function AboutPage() {
  const navigate = useNavigate();
  const signIn = useMarketStore((s) => s.signIn);

  const handleAuthed = (u: CurrentUser) => {
    signIn(u);
    navigate(u.school_year ? "/" : "/setup", { replace: true });
  };

  return <LandingPage onAuthed={handleAuthed} />;
}
