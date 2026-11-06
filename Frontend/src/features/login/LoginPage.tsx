import { useState } from "react";
import { AuthCard } from "./AuthCard";
import type { AuthMode } from "@/features/public/PublicChrome";
import {
  PublicFooter,
  PublicHero,
  PublicJoinBand,
  PublicNav,
  PublicTiles,
} from "@/features/public/PublicChrome";
import type { CurrentUser } from "@/lib/types";
import s from "@/features/public/publicChrome.module.css";

export function LoginPage({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("signup");

  return (
    <div className={s.page}>
      <PublicNav onSignUp={() => setMode("signup")} onLogIn={() => setMode("signin")} />

      <main className={s.main}>
        <PublicHero onSignUp={() => setMode("signup")}>
          <AuthCard mode={mode} onModeChange={setMode} onAuthed={onAuthed} />
        </PublicHero>

        <PublicTiles />
        <PublicJoinBand onJoin={() => setMode("signup")} />
      </main>

      <PublicFooter onSignUp={() => setMode("signup")} onLogIn={() => setMode("signin")} />
    </div>
  );
}
