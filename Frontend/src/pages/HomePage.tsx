import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Fuse from "fuse.js";
import { Search, Grid, List } from "lucide-react";
import { useMarketStore } from "@/lib/store";
import { CATEGORIES } from "@/data/categories";
import { ListingCard } from "@/features/listings/ListingCard";
import { ListingRow } from "@/features/listings/ListingRow";
import s from "./HomePage.module.css";
import ps from "./page.module.css";

export function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const activeCategory = params.get("category") ?? "all";
  const searchQuery = params.get("q") ?? "";
  const sortBy = params.get("sort") ?? "recent";
  const viewSaved = params.get("saved") === "1";
  const viewMine = params.get("mine") === "1";
  const minPrice = params.get("minPrice");
  const maxPrice = params.get("maxPrice");
  const locationFilter = params.get("location");
  const activeConditions = (params.get("condition") ?? "").split(",").filter(Boolean);

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

  const fuse = useMemo(
    () =>
      new Fuse(listings, {
        keys: [
          { name: "title", weight: 0.6 },
          { name: "campus", weight: 0.25 },
          { name: "description", weight: 0.15 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [listings]
  );

  const searchMatches = useMemo(
    () => (searchQuery.trim() ? fuse.search(searchQuery.trim()) : null),
    [fuse, searchQuery]
  );
  const matchedIds = searchMatches && new Set(searchMatches.map((r) => r.item.id));
  const relevanceRank =
    searchMatches && new Map(searchMatches.map((r, i) => [r.item.id, i]));

  const filtered = listings
    .filter((l) => {
      if (viewMine) return !!user && l.sellerId === user.id;
      if (viewSaved) return savedItems.has(l.id);
      if (l.status === "sold") return false;
      const matchCat = activeCategory === "all" || l.category === activeCategory;
      const matchSearch = !matchedIds || matchedIds.has(l.id);
      const matchMin = !minPrice || l.price >= Number(minPrice);
      const matchMax = !maxPrice || l.price <= Number(maxPrice);
      const matchLocation =
        !locationFilter || l.campus.toLowerCase().includes(locationFilter.toLowerCase());
      const matchCondition =
        activeConditions.length === 0 || activeConditions.includes(l.condition);
      return matchCat && matchSearch && matchMin && matchMax && matchLocation && matchCondition;
    })
    .sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (relevanceRank) return (relevanceRank.get(a.id) ?? 0) - (relevanceRank.get(b.id) ?? 0);
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
