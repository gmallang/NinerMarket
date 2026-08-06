import { useNavigate } from "react-router-dom";
import { LoginPage as LoginView } from "@/features/login/LoginPage";
import { useMarketStore } from "@/lib/store";
import type { CurrentUser } from "@/lib/types";

export function LoginPage() {
  const navigate = useNavigate();
  const signIn = useMarketStore((s) => s.signIn);

  const handleAuthed = (u: CurrentUser) => {
    signIn(u);
    navigate(u.school_year ? "/" : "/setup", { replace: true });
  };

  return <LoginView onAuthed={handleAuthed} />;
}
