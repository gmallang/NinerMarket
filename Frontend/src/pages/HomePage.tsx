import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Grid, List } from "lucide-react";
import { api } from "@/lib/api";
import { fromDto } from "@/lib/listings";
import { useMarketStore } from "@/lib/store";
import { CATEGORIES } from "@/data/categories";
import type { Listing } from "@/lib/types";
import { ListingCard } from "@/features/listings/ListingCard";
import { ListingRow } from "@/features/listings/ListingRow";
import { HomeHero } from "@/components/home/HomeHero";
import { CategoryShortcuts } from "@/components/home/CategoryShortcuts";
import { RecentlyListed } from "@/components/home/RecentlyListed";
import { LookingForSection } from "@/components/home/LookingForSection";
import s from "./HomePage.module.css";
import ps from "./page.module.css";

const SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

/** Numbered page list with ellipsis gaps, e.g. 1 … 4 5 6 … 12. */
function pageWindow(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(current - 1, count - 4));
  const end = Math.min(count - 1, Math.max(current + 1, 5));
  const pages: (number | "gap")[] = [1];
  if (start > 2) pages.push("gap");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < count - 1) pages.push("gap");
  pages.push(count);
  return pages;
}

export function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const activeCategory = params.get("category") ?? "all";
  const searchQuery = params.get("q") ?? "";
  const sortBy = params.get("sort") ?? "recent";
  const viewSaved = params.get("saved") === "1";

  const locationParam = params.get("location");
  const locationFilter = locationParam && locationParam !== "all" ? locationParam : null;
  const conditionParam = params.get("condition") ?? "";
  // Price filters are written by the sidebar as `minPrice` / `maxPrice`.
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";
  const pageParam = Math.max(1, Number(params.get("page")) || 1);
  const limitParam = Number(params.get("limit")) || 24;
  const viewMine = params.get("mine") === "1";
  // Memoized on the raw string, not re-split into a fresh array on every
  // render — otherwise `filtered` below would recompute unconditionally
  // since a new array reference never equals the previous one.
  const activeConditions = useMemo(
    () => conditionParam.split(",").filter(Boolean),
    [conditionParam]
  );

  const listings = useMarketStore((s) => s.listings);
  const loading = useMarketStore((s) => s.loading);
  const hasMoreListings = useMarketStore((s) => s.hasMoreListings);
  const listingsError = useMarketStore((s) => s.listingsError);
  const listingsTotal = useMarketStore((s) => s.listingsTotal);
  const loadListings = useMarketStore((s) => s.loadListings);
  const savedItems = useMarketStore((s) => s.savedItems);
  const user = useMarketStore((s) => s.user);
  const toggleSave = useMarketStore((s) => s.toggleSave);
  const openMessageOverlay = useMarketStore((s) => s.openMessageOverlay);
  const openListingOverlay = useMarketStore((s) => s.openListingOverlay);

  // The marketplace grid is server-paginated now, so it only holds the current
  // page of active listings. The "your listings" and "saved" views need their
  // own complete sets — sold items included — so load those separately.
  // Both caches are keyed by what they were fetched for, so switching views
  // never shows one user's listings under another's heading.
  const [owned, setOwned] = useState<{ userId: string; items: Listing[] } | null>(null);
  const [saved, setSaved] = useState<{ ids: string; items: Listing[] } | null>(null);

  useEffect(() => {
    if (!viewMine || !user) return;
    let alive = true;
    // Empty status = every listing the seller has, sold ones included.
    api
      .getUserListings(user.id, "")
      .then((dtos) => {
        if (alive) setOwned({ userId: user.id, items: dtos.map(fromDto) });
      })
      .catch(() => {
        // Keep the paginated listings as a fallback.
      });
    return () => {
      alive = false;
    };
  }, [viewMine, user]);

  const savedIdsKey = useMemo(() => [...savedItems].sort().join(","), [savedItems]);

  useEffect(() => {
    if (!viewSaved || !savedIdsKey) return;
    let alive = true;
    // Saved items are stored as ids and may have sold since they were saved,
    // so fetch the records instead of intersecting with the paginated page.
    void Promise.allSettled(savedIdsKey.split(",").map((id) => api.getListing(id))).then(
      (results) => {
        if (!alive) return;
        setSaved({
          ids: savedIdsKey,
          items: results.flatMap((r) => (r.status === "fulfilled" ? [fromDto(r.value)] : [])),
        });
      }
    );
    return () => {
      alive = false;
    };
  }, [viewSaved, savedIdsKey]);

  const categoryLabel = CATEGORIES.find((c) => c.id === activeCategory)?.label;

  // Keyword search, category, price, location and condition are all applied by
  // the backend now, so a refetch happens whenever any of them change.
  const prevQ = useRef(searchQuery);
  const prevFilters = useRef<string>("");
  useEffect(() => {
    if (viewSaved || viewMine) return;
    const fKey = JSON.stringify({ category: activeCategory, sortBy, locationFilter, conditions: activeConditions.join(","), pageParam, limitParam, minPrice, maxPrice });
    if (prevQ.current === searchQuery && prevFilters.current === fKey) return;
    prevQ.current = searchQuery;
    prevFilters.current = fKey;
    void loadListings(false, searchQuery, {
      category: activeCategory === "all" ? undefined : activeCategory,
      sort: sortBy,
      location: locationFilter ?? undefined,
      condition: activeConditions.length ? activeConditions.join(",") : undefined,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
      offset: (pageParam - 1) * limitParam,
      limit: limitParam,
    });
  }, [searchQuery, loadListings, viewSaved, viewMine, activeCategory, sortBy, locationFilter, activeConditions, pageParam, limitParam, minPrice, maxPrice]);

  const source = viewMine
    ? (owned && owned.userId === user?.id ? owned.items : listings)
    : viewSaved
      ? (saved && saved.ids === savedIdsKey ? saved.items : listings)
      : listings;

  const filtered = useMemo(
    () =>
      source
        .filter((l) => {
          if (viewMine) return !!user && l.sellerId === user.id;
          if (viewSaved) return savedItems.has(l.id);
          return l.status !== "sold" && l.status !== "flagged";
        })
        .sort((a, b) => {
          if (sortBy === "price-asc") return a.price - b.price;
          if (sortBy === "price-desc") return b.price - a.price;
          return b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0;
        }),
    [source, viewMine, viewSaved, user, savedItems, sortBy]
  );

  const openListing = (id: string) => openListingOverlay(id);
  const openSeller = (id: string) => navigate(`/user/${id}`);
  const messageListing = (id: string) => openMessageOverlay(id);

  const isDefaultView =
    !viewMine &&
    !viewSaved &&
    activeCategory === "all" &&
    !searchQuery &&
    !minPrice &&
    !maxPrice &&
    !locationFilter &&
    activeConditions.length === 0 &&
    sortBy === "recent" &&
    pageParam === 1;

  const totalCount =
    listingsTotal ?? (pageParam - 1) * limitParam + filtered.length + (hasMoreListings ? 1 : 0);
  const pageCount = Math.max(1, Math.ceil(totalCount / limitParam));
  const rangeStart = filtered.length === 0 ? 0 : (pageParam - 1) * limitParam + 1;
  const rangeEnd = (pageParam - 1) * limitParam + filtered.length;

  const setParam = (key: string, value: string | null) => {
    const p = new URLSearchParams(params);
    if (value === null || value === "") p.delete(key);
    else p.set(key, value);
    navigate({ search: p.toString() }, { replace: true });
  };

  const goToPage = (page: number) => {
    setParam("page", String(Math.min(Math.max(1, page), pageCount)));
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const heading = viewMine ? "Your Listings" : viewSaved ? "Saved Items" : "All Listings";

  return (
    <div className={ps.page}>
      {isDefaultView && <HomeHero />}
      {isDefaultView && <CategoryShortcuts />}
      {isDefaultView && <RecentlyListed />}
      {isDefaultView && <LookingForSection />}

      <div className={s.mainHeader} id="listings">
        <div>
          <h1 className={s.mainTitle}>{heading}</h1>
          <p className={s.mainCount}>
            {viewMine
              ? `${filtered.length} listing${filtered.length === 1 ? "" : "s"}`
              : viewSaved
                ? `${filtered.length} saved item${filtered.length === 1 ? "" : "s"}`
                : `${totalCount} listing${totalCount === 1 ? "" : "s"}${
                    activeCategory !== "all" && categoryLabel ? ` in ${categoryLabel}` : ""
                  }`}
          </p>
        </div>
        <div className={s.controls}>
          {!viewMine && !viewSaved && (
            <label className={s.sortLabel}>
              Sort
              <select
                className={s.sortSelect}
                value={sortBy}
                onChange={(e) => {
                  const p = new URLSearchParams(params);
                  p.set("sort", e.target.value);
                  p.delete("page");
                  navigate({ search: p.toString() }, { replace: true });
                }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={s.viewToggle}>
            <button
              className={`${s.viewBtn} ${viewMode === "grid" ? s.viewBtnActive : ""}`}
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
            >
              <Grid size={15} />
            </button>
            <button
              className={`${s.viewBtn} ${viewMode === "list" ? s.viewBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
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

      {/* Keep the current page visible while a filtered refetch is in flight. */}
      {loading && filtered.length === 0 && !viewMine && !viewSaved ? (
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
        <div className={s.grid} role="region" aria-label="Listings">
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
        <div className={s.listView} role="region" aria-label="Listings">
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

      {!viewSaved && !viewMine && filtered.length > 0 && (
        <div className={s.pagination}>
          <div className={s.pageInfo}>
            <span>
              Showing {rangeStart}–{rangeEnd} of {totalCount} listings
            </span>
            <label className={s.pageSize}>
              Per page
              <select
                value={String(limitParam)}
                onChange={(e) => {
                  const p = new URLSearchParams(params);
                  p.set("limit", e.target.value);
                  p.set("page", "1");
                  navigate({ search: p.toString() }, { replace: true });
                }}
              >
                <option value="12">12</option>
                <option value="24">24</option>
                <option value="48">48</option>
              </select>
            </label>
          </div>
          <div className={s.pageBtns}>
            <button className={s.pageNav} disabled={pageParam <= 1} onClick={() => goToPage(pageParam - 1)}>
              Previous
            </button>
            <div className={s.pageNumbers}>
              {pageWindow(pageParam, pageCount).map((item, index) =>
                item === "gap" ? (
                  <span key={`gap-${index}`} className={s.pageGap}>
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    className={`${s.pageNum} ${item === pageParam ? s.pageNumActive : ""}`}
                    onClick={() => goToPage(item)}
                    aria-current={item === pageParam ? "page" : undefined}
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
            <button
              className={s.pageNav}
              disabled={pageParam >= pageCount}
              onClick={() => goToPage(pageParam + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
