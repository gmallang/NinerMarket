import { useEffect, useMemo, useRef, useState } from "react";
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
  const conditionParam = params.get("condition") ?? "";
  // Memoized on the raw string, not re-split into a fresh array on every
  // render — otherwise `filtered` below would recompute unconditionally
  // since a new array reference never equals the previous one.
  const activeConditions = useMemo(
    () => conditionParam.split(",").filter(Boolean),
    [conditionParam]
  );

  const listings = useMarketStore((s) => s.listings);
  const loading = useMarketStore((s) => s.loading);
  const loadingMore = useMarketStore((s) => s.loadingMore);
  const hasMoreListings = useMarketStore((s) => s.hasMoreListings);
  const listingsError = useMarketStore((s) => s.listingsError);
  const loadListings = useMarketStore((s) => s.loadListings);
  const loadMoreListings = useMarketStore((s) => s.loadMoreListings);
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

  // Keyword search is handled server-side (the /listings?q= endpoint). When the
  // query in the URL changes, refetch from the backend with it; category, price,
  // location and condition filters all still run client-side over the loaded set.
  const prevQ = useRef(searchQuery);
  useEffect(() => {
    if (viewSaved || viewMine || prevQ.current === searchQuery) return;
    prevQ.current = searchQuery;
    // Silent refetch — keep showing the current grid rather than flashing the
    // loading spinner on every keystroke.
    void loadListings(true, searchQuery);
  }, [searchQuery, loadListings, viewSaved, viewMine]);

  const filtered = useMemo(
    () =>
      listings.filter((l) => {
        if (viewMine) return !!user && l.sellerId === user.id;
        if (viewSaved) return savedItems.has(l.id);
        if (l.status === "sold" || l.status === "flagged") return false;
        const matchCat = activeCategory === "all" || l.category === activeCategory;
        const matchMin = !minPrice || l.price >= Number(minPrice);
        const matchMax = !maxPrice || l.price <= Number(maxPrice);
        const matchLocation =
          !locationFilter || l.campus.toLowerCase().includes(locationFilter.toLowerCase());
        const matchCondition =
          activeConditions.length === 0 || activeConditions.includes(l.condition);
        return matchCat && matchMin && matchMax && matchLocation && matchCondition;
      }).sort((a, b) => {
          if (sortBy === "price-asc") return a.price - b.price;
          if (sortBy === "price-desc") return b.price - a.price;
          // ISO 8601 strings sort lexicographically, so direct string comparison
          // is equivalent to comparing timestamps without creating Date objects.
          return b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0;
        }),
    [
      listings,
      viewMine,
      viewSaved,
      user,
      savedItems,
      activeCategory,
      minPrice,
      maxPrice,
      locationFilter,
      activeConditions,
      sortBy,
    ]
  );

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
              ? `${filtered.length} listing${filtered.length === 1 ? "" : "s"}`
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

      {hasMoreListings && !viewSaved && !viewMine && (
        <div className={s.loadMoreWrap}>
          <button
            type="button"
            className={s.loadMoreBtn}
            onClick={() => loadMoreListings()}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading\u2026" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
