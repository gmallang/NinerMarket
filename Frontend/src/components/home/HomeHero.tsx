import { useEffect, useState } from "react";
import { ArrowRight, Plus, Package, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useMarketStore } from "@/lib/store";
import s from "./HomeHero.module.css";

export function HomeHero() {
  const listingsTotal = useMarketStore((state) => state.listingsTotal);
  const listings = useMarketStore((state) => state.listings);
  const requestsVersion = useMarketStore((state) => state.requestsVersion);
  const openRequestForm = useMarketStore((state) => state.openRequestForm);
  const openSellForm = useMarketStore((state) => state.openSellForm);

  const [activeRequests, setActiveRequests] = useState<number | null>(null);

  // Real counts only — the hero shows what the backend actually has.
  useEffect(() => {
    let alive = true;
    api
      .listRequests({ status: "active", limit: 1 })
      .then(({ items, total }) => {
        if (alive) setActiveRequests(total ?? items.length);
      })
      .catch(() => {
        // Leave the stat hidden rather than inventing a number.
      });
    return () => {
      alive = false;
    };
  }, [requestsVersion]);

  const listingCount = listingsTotal ?? listings.length;

  const scrollToListings = () => {
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={s.copy}>
        <h1 className={s.title} id="hero-title">
          Your campus. Your marketplace.
        </h1>
        <p className={s.subtitle}>
          Buy what you need. Sell what you don't. Find what you've been looking for — all from
          fellow Niners.
        </p>
        <div className={s.actions}>
          <button type="button" className={s.primaryBtn} onClick={scrollToListings}>
            Explore Listings
            <ArrowRight size={15} />
          </button>
          <button type="button" className={s.secondaryBtn} onClick={openRequestForm}>
            <Search size={15} />
            Post a Request
          </button>
          <button type="button" className={s.ghostBtn} onClick={openSellForm}>
            <Plus size={15} />
            Sell an Item
          </button>
        </div>
      </div>

      <div className={s.stats}>
        <div className={s.stat}>
          <Package size={16} className={s.statIcon} />
          <span className={s.statValue}>{listingCount.toLocaleString()}</span>
          <span className={s.statLabel}>
            {listingCount === 1 ? "listing" : "listings"} on the market
          </span>
        </div>
        <div className={s.statDivider} aria-hidden="true" />
        <div className={s.stat}>
          <Search size={16} className={s.statIcon} />
          <span className={s.statValue}>
            {activeRequests === null ? "—" : activeRequests.toLocaleString()}
          </span>
          <span className={s.statLabel}>
            {activeRequests === 1 ? "student is" : "students are"} looking for something
          </span>
        </div>
      </div>
    </section>
  );
}
