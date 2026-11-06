import { useEffect, useState } from "react";
import { ArrowRight, Lock, Megaphone } from "lucide-react";
import { ListingCard } from "@/features/listings/ListingCard";
import { fromDto } from "@/lib/listings";
import { api } from "@/lib/api";
import type { CurrentUser, Listing, WantedRequestDto } from "@/lib/types";
import { AuthCard } from "@/features/login/AuthCard";
import type { AuthMode } from "@/features/public/PublicChrome";
import {
  PublicFooter,
  PublicHero,
  PublicJoinBand,
  PublicNav,
  PublicTiles,
} from "@/features/public/PublicChrome";
import s from "@/features/public/publicChrome.module.css";
import l from "./landing.module.css";

/** "$40 – $60", "Up to $35", … for the Looking For preview. */
function budgetLabel(request: WantedRequestDto): string {
  if (request.budget_min != null && request.budget_max != null) {
    return `$${request.budget_min} – $${request.budget_max}`;
  }
  if (request.budget_max != null) return `Up to $${request.budget_max}`;
  if (request.budget_min != null) return `From $${request.budget_min}`;
  return "Open budget";
}

/**
 * Public about page. Same shell as /login - green navbar, the auth card hero,
 * the three example columns - plus a preview of what is live on the market.
 */
export function LandingPage({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [featured, setFeatured] = useState<Listing[]>([]);
  const [requests, setRequests] = useState<WantedRequestDto[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .listListings({ limit: 4, sort: "recent" })
      .then(({ items }) => {
        if (!alive) return;
        setFeatured(items.map(fromDto));
      })
      .catch(() => {
        // The preview is decorative - the page still reads fine without it.
      });
    api
      .listRequests({ status: "active", limit: 3 })
      .then(({ items }) => {
        if (!alive) return;
        setRequests(items);
      })
      .catch(() => {
        // Same as above.
      });
    return () => {
      alive = false;
    };
  }, []);

  const openSignUp = () => setMode("signup");

  return (
    <div className={s.page}>
      <PublicNav onSignUp={openSignUp} onLogIn={() => setMode("signin")} />

      <main className={s.main}>
        <PublicHero onSignUp={openSignUp}>
          <AuthCard mode={mode} onModeChange={setMode} onAuthed={onAuthed} />
        </PublicHero>

        <PublicTiles />

        <div className={l.container}>
          <section className={l.marketRow}>
            <div className={l.recentCol}>
              <div className={l.recentHead}>
                <div>
                  <h2 className={l.recentTitle}>Recently Listed</h2>
                  <p className={l.recentSub}>Browse items fellow Niners are selling.</p>
                </div>
                <button type="button" className={l.viewAll} onClick={openSignUp}>
                  View all →
                </button>
              </div>
              <div className={l.recentGrid}>
                {featured.map((item) => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    saved={false}
                    onToggleSave={openSignUp}
                    onOpen={openSignUp}
                    blurSeller
                  />
                ))}
              </div>
            </div>

            <aside className={l.lookingCol}>
              <h2 className={l.lookingTitle}>
                <Megaphone size={19} /> Looking For?
              </h2>
              <p className={l.lookingSub}>Help fellow Niners find what they need.</p>
              <ul className={l.reqList}>
                {requests.map((request) => (
                  <li key={request.id} className={l.reqRow}>
                    <span className={l.reqIcon}>
                      <Lock size={15} />
                    </span>
                    <div className={l.reqBody}>
                      <span className={l.reqTitle}>{request.title}</span>
                      <span className={l.reqBudget}>{budgetLabel(request)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <button type="button" className={l.browseAll} onClick={openSignUp}>
                Browse all requests <ArrowRight size={15} />
              </button>
            </aside>
          </section>
        </div>

        <PublicJoinBand onJoin={openSignUp} />
      </main>

      <PublicFooter onSignUp={openSignUp} onLogIn={() => setMode("signin")} />
    </div>
  );
}
