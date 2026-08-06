import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Grid, List } from "lucide-react";
import { useMarketStore } from "@/lib/store";
import { CATEGORIES } from "@/data/categories";
import { ListingCard } from "@/features/listings/ListingCard";
import { ListingRow } from "@/features/listings/ListingRow";
import s from "./HomePage.module.css";
import ps from "./page.module.css";

export function HomePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const activeCategory = params.get("category") ?? "all";
  const searchQuery = params.get("q") ?? "";
  const sortBy = params.get("sort") ?? "recent";
  const viewSaved = params.get("saved") === "1";
  const viewMine = params.get("mine") === "1";

  const listings = useMarketStore((s) => s.listings);
  const loading = useMarketStore((s) => s.loading);
  const listingsError = useMarketStore((s) => s.listingsError);
  const loadListings = useMarketStore((s) => s.loadListings);
  const savedItems = useMarketStore((s) => s.savedItems);
  const user = useMarketStore((s) => s.user);
  const toggleSave = useMarketStore((s) => s.toggleSave);
  const openMessageOverlay = useMarketStore((s) => s.openMessageOverlay);
  const openListingOverlay = useMarketStore((s) => s.openListingOverlay);

  const viewLabel = viewMine
    ? "Your Listings"
    : viewSaved
      ? "Saved Items"
      : (CATEGORIES.find((c) => c.id === activeCategory)?.label ?? "All Categories");

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "category") {
      next.delete("saved");
      next.delete("mine");
    }
    setParams(next, { replace: true });
  };

  const filtered = listings
    .filter((l) => {
      if (viewMine) return !!user && l.sellerId === user.id;
      if (viewSaved) return savedItems.has(l.id);
      const matchCat = activeCategory === "all" || l.category === activeCategory;
      const matchSearch =
        !searchQuery ||
        l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.campus.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      return 0;
    });

  const openListing = (id: string) => openListingOverlay(id);
  const openSeller = (id: string) => navigate(`/user/${id}`);
  const messageListing = (id: string) => openMessageOverlay(id);

  return (
    <div className={ps.page}>
      <div className={s.mainHeader}>
        <div>
          <h1 className={s.mainTitle}>{viewLabel}</h1>
          <p className={s.mainCount}>
            {viewMine
              ? `${filtered.length} active listing${filtered.length === 1 ? "" : "s"}`
              : viewSaved
                ? `${filtered.length} saved item${filtered.length === 1 ? "" : "s"}`
                : `${filtered.length} listings near your campus`}
          </p>
        </div>
        <div className={s.controls}>
          <select
            className={s.sortSelect}
            value={sortBy}
            onChange={(e) => setParam("sort", e.target.value)}
          >
            <option value="recent">Most Recent</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
          </select>
          <div className={s.viewToggle}>
            <button
              className={`${s.viewBtn} ${viewMode === "grid" ? s.viewBtnActive : ""}`}
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
            >
              <Grid size={15} />
            </button>
            <button
              className={`${s.viewBtn} ${viewMode === "list" ? s.viewBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {listingsError && (
        <div className={s.demoBanner}>
          Couldn't load listings — {listingsError}
          <button className={s.retryBtn} onClick={() => void loadListings()}>
            Retry
          </button>
        </div>
      )}

      <div className={s.mobilePills}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`${s.pill} ${activeCategory === cat.id ? s.pillActive : ""}`}
            onClick={() => setParam("category", cat.id === "all" ? "" : cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={s.emptyState}>
          <Search size={44} className={s.emptyIcon} />
          <p className={s.emptyTitle}>Loading listings...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={s.emptyState}>
          <Search size={44} className={s.emptyIcon} />
          <p className={s.emptyTitle}>
            {viewMine
              ? "You haven't listed anything yet"
              : viewSaved
                ? "No saved items yet"
                : "No listings found"}
          </p>
          <p className={s.emptyBody}>
            {viewMine
              ? "List an item to start selling"
              : viewSaved
                ? "Tap the heart on a listing to save it here"
                : "Try a different search or category"}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className={s.grid}>
          {filtered.map((item) => {
            const sellerId = item.sellerId;
            return (
              <ListingCard
                key={item.id}
                item={item}
                saved={savedItems.has(item.id)}
                onToggleSave={() => toggleSave(item.id)}
                onOpen={() => openListing(item.id)}
                onOpenSeller={sellerId ? () => openSeller(sellerId) : undefined}
              />
            );
          })}
        </div>
      ) : (
        <div className={s.listView}>
          {filtered.map((item) => {
            const sellerId = item.sellerId;
            return (
              <ListingRow
                key={item.id}
                item={item}
                saved={savedItems.has(item.id)}
                onToggleSave={() => toggleSave(item.id)}
                onOpen={() => openListing(item.id)}
                onMessage={() => messageListing(item.id)}
                onOpenSeller={sellerId ? () => openSeller(sellerId) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
