import { Link } from "react-router-dom";
import { useMarketStore } from "@/lib/store";
import { ListingCard } from "@/features/listings/ListingCard";
import s from "./RecentlyListed.module.css";

export function RecentlyListed() {
  const listings = useMarketStore((state) => state.listings);
  const savedItems = useMarketStore((state) => state.savedItems);
  const toggleSave = useMarketStore((state) => state.toggleSave);
  const openListingOverlay = useMarketStore((state) => state.openListingOverlay);

  const recent = [...listings]
    .filter((l) => l.status !== "sold" && l.status !== "flagged")
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0))
    .slice(0, 4);

  if (recent.length === 0) return null;

  return (
    <section className={s.section}>
      <div className={s.header}>
        <div className={s.titleWrap}>
          <h2 className={s.title}>Recently Listed</h2>
          <p className={s.subtitle}>Fresh finds from your fellow Niners.</p>
        </div>
        <Link to="/" className={s.viewAll}>
          View All
        </Link>
      </div>
      <div className={s.grid}>
        {recent.map((item) => (
          <ListingCard
            key={item.id}
            item={item}
            saved={savedItems.has(item.id)}
            onToggleSave={() => toggleSave(item.id)}
            onOpen={() => openListingOverlay(item.id)}
            onOpenSeller={item.sellerId ? () => (window.location.href = `/user/${item.sellerId}`) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
