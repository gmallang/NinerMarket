import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useMarketStore } from "@/lib/store";
import { CATEGORIES } from "@/data/categories";
import type { WantedRequestDto } from "@/lib/types";
import { RequestCard } from "@/components/requests/RequestCard";
import s from "./RequestsPage.module.css";
import ps from "./page.module.css";

const PAGE_SIZE = 12;

/** Public "Looking For" feed — active requests from across campus. */
export function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const user = useMarketStore((state) => state.user);
  const requestsVersion = useMarketStore((state) => state.requestsVersion);
  const openRequestForm = useMarketStore((state) => state.openRequestForm);
  const respondToRequest = useMarketStore((state) => state.respondToRequest);

  const category = params.get("category") ?? "all";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [items, setItems] = useState<WantedRequestDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(q);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listRequests({
        status: "active",
        category: category === "all" ? undefined : category,
        q,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })
      .then(({ items: list, total: count }) => {
        if (!alive) return;
        setItems(list);
        setTotal(count ?? list.length);
        setError("");
      })
      .catch((err) => {
        if (!alive) return;
        setItems([]);
        setError(err instanceof Error ? err.message : "Couldn't load requests");
      });
    return () => {
      alive = false;
    };
  }, [category, q, page, requestsVersion]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const updateParams = (next: Record<string, string | null>, resetPage = true) => {
    const p = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") p.delete(key);
      else p.set(key, value);
    }
    if (resetPage) p.delete("page");
    setParams(p, { replace: true });
  };

  const respond = async (request: WantedRequestDto) => {
    setPendingId(request.id);
    try {
      await respondToRequest(request);
    } finally {
      setPendingId(null);
    }
  };

  const pageNumbers = useMemo(() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const start = Math.min(Math.max(1, page - 2), pageCount - 4);
    return Array.from({ length: 5 }, (_, i) => start + i);
  }, [page, pageCount]);

  return (
    <div className={ps.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Looking For</h1>
          <p className={s.subtitle}>
            Can't find what you need? See what fellow Niners are searching for — or ask for it
            yourself.
          </p>
        </div>
        <div className={s.headerActions}>
          <Link to="/requests/mine" className={s.secondaryBtn}>
            My Requests
          </Link>
          <button type="button" className={s.primaryBtn} onClick={openRequestForm}>
            <Plus size={15} /> Post a Request
          </button>
        </div>
      </div>

      <div className={s.toolbar}>
        <form
          className={s.searchWrap}
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ q: search.trim() });
          }}
          role="search"
        >
          <Search size={15} className={s.searchIcon} />
          <input
            className={s.searchInput}
            type="search"
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search requests"
          />
        </form>
        <label className={s.filterLabel}>
          Category
          <select
            className={s.select}
            value={category}
            onChange={(e) => updateParams({ category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className={s.error}>Couldn't load requests — {error}</div>}

      {items === null ? (
        <div className={s.grid} aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={s.placeholder} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={s.empty}>
          <Search size={44} className={s.emptyIcon} />
          <p className={s.emptyTitle}>No open requests match</p>
          <p className={s.emptyBody}>
            {q || category !== "all"
              ? "Try a different search or category."
              : "Nobody is looking for anything right now — post the first request."}
          </p>
          <button type="button" className={s.primaryBtn} onClick={openRequestForm}>
            <Plus size={15} /> Post a Request
          </button>
        </div>
      ) : (
        <>
          <p className={s.count}>
            {total} active {total === 1 ? "request" : "requests"}
          </p>
          <div className={s.grid}>
            {items.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                currentUserId={user?.id}
                respondPending={pendingId === request.id}
                onRespond={() => void respond(request)}
              />
            ))}
          </div>
        </>
      )}

      {items !== null && items.length > 0 && pageCount > 1 && (
        <div className={s.pagination}>
          <button
            className={s.pageBtn}
            onClick={() => updateParams({ page: String(page - 1) }, false)}
            disabled={page <= 1}
          >
            Previous
          </button>
          <div className={s.pageNumbers}>
            {pageNumbers[0] > 1 && (
              <>
                <button className={s.pageNum} onClick={() => updateParams({ page: "1" }, false)}>
                  1
                </button>
                {pageNumbers[0] > 2 && <span className={s.ellipsis}>…</span>}
              </>
            )}
            {pageNumbers.map((n) => (
              <button
                key={n}
                className={`${s.pageNum} ${n === page ? s.pageNumActive : ""}`}
                onClick={() => updateParams({ page: String(n) }, false)}
                aria-current={n === page ? "page" : undefined}
              >
                {n}
              </button>
            ))}
            {pageNumbers[pageNumbers.length - 1] < pageCount && (
              <>
                {pageNumbers[pageNumbers.length - 1] < pageCount - 1 && (
                  <span className={s.ellipsis}>…</span>
                )}
                <button
                  className={s.pageNum}
                  onClick={() => updateParams({ page: String(pageCount) }, false)}
                >
                  {pageCount}
                </button>
              </>
            )}
          </div>
          <button
            className={s.pageBtn}
            onClick={() => updateParams({ page: String(page + 1) }, false)}
            disabled={page >= pageCount}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
