import { useEffect, useState } from "react";
import { Flag, Megaphone, Search, ShoppingBag, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { useMarketStore } from "@/lib/store";
import type { AdminListing, AdminUser, WantedRequestDto } from "@/lib/types";
import s from "./AdminPage.module.css";
import ps from "./page.module.css";

type Tab = "listings" | "requests" | "accounts";

const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: "listings", label: "Listings", icon: ShoppingBag },
  { id: "requests", label: "Requests", icon: Megaphone },
  { id: "accounts", label: "Accounts", icon: Users },
];

const STATUS_OPTIONS = ["all", "active", "sold", "flagged"];
const REQUEST_STATUS_OPTIONS = ["all", "active", "fulfilled", "expired"];

function budgetLabel(request: WantedRequestDto): string {
  const { budget_min: min, budget_max: max } = request;
  if (min != null && max != null) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (min != null) return `From $${min.toLocaleString()}`;
  if (max != null) return `Up to $${max.toLocaleString()}`;
  return "No budget given";
}

export function AdminPage() {
  const me = useMarketStore((state) => state.user);

  const [tab, setTab] = useState<Tab>("listings");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [listings, setListings] = useState<AdminListing[] | null>(null);
  const [requests, setRequests] = useState<WantedRequestDto[] | null>(null);
  const [accounts, setAccounts] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Clears one section back to its loading state. Called from the handlers
  // that change what we're looking at — not from inside the effect, which
  // must not set state synchronously.
  const clearTab = (target: Tab) => {
    if (target === "listings") setListings(null);
    else if (target === "requests") setRequests(null);
    else setAccounts(null);
    setTotal(undefined);
    setError("");
  };

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        if (tab === "listings") {
          const page = await api.adminListListings({ q: query, status });
          if (!alive) return;
          setListings(page.items);
          setTotal(page.total);
        } else if (tab === "requests") {
          const page = await api.adminListRequests({ q: query, status });
          if (!alive) return;
          setRequests(page.items);
          setTotal(page.total);
        } else {
          const page = await api.adminListUsers({ q: query });
          if (!alive) return;
          setAccounts(page.items);
          setTotal(page.total);
        }
      } catch (err) {
        if (!alive) return;
        if (tab === "listings") setListings([]);
        else if (tab === "requests") setRequests([]);
        else setAccounts([]);
        setError(
          err instanceof Error ? err.message : "Couldn't load the admin data — try again.",
        );
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [tab, query, status]);

  const run = async (id: string, action: () => Promise<unknown>, onDone: () => void) => {
    setBusyId(id);
    setError("");
    try {
      await action();
      onDone();
      setTotal((current) => (current == null ? current : Math.max(0, current - 1)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that — try again.");
    } finally {
      setBusyId(null);
    }
  };

  const removeListing = (listing: AdminListing) => {
    if (!window.confirm(`Delete "${listing.name}"? This can't be undone.`)) return;
    void run(listing.id, () => api.adminDeleteListing(listing.id), () =>
      setListings((list) => list?.filter((item) => item.id !== listing.id) ?? list),
    );
  };

  const removeRequest = (request: WantedRequestDto) => {
    if (!window.confirm(`Delete "${request.title}"? This can't be undone.`)) return;
    void run(request.id, () => api.adminDeleteRequest(request.id), () =>
      setRequests((list) => list?.filter((item) => item.id !== request.id) ?? list),
    );
  };

  const removeAccount = (account: AdminUser) => {
    if (
      !window.confirm(
        `Delete ${account.display_name}'s account? Their listings and requests go with it. This can't be undone.`,
      )
    ) {
      return;
    }
    void run(account.id, () => api.adminDeleteUser(account.id), () =>
      setAccounts((list) => list?.filter((item) => item.id !== account.id) ?? list),
    );
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setStatus("all");
    setQuery("");
    setDraft("");
    clearTab(next);
  };

  const loading =
    (tab === "listings" && listings === null) ||
    (tab === "requests" && requests === null) ||
    (tab === "accounts" && accounts === null);

  const count = total ?? 0;

  return (
    <div className={ps.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Admin panel</h1>
          <p className={s.subtitle}>
            Every listing, request and account on NinerMarket. Deletions are permanent and show up
            for other students right away.
          </p>
        </div>
      </div>

      <div className={s.tabs} role="tablist" aria-label="Admin sections">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`${s.tab} ${tab === t.id ? s.tabActive : ""}`}
              onClick={() => switchTab(t.id)}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <form
        className={s.toolbar}
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
          clearTab(tab);
        }}
      >
        <div className={s.searchWrap}>
          <span className={s.searchIcon}>
            <Search size={14} />
          </span>
          <input
            className={s.searchInput}
            type="search"
            placeholder={
              tab === "accounts" ? "Search by name or email…" : "Search by title or text…"
            }
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>

        {tab !== "accounts" && (
          <label className={s.filterLabel}>
            Status
            <select
              className={s.select}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                clearTab(tab);
              }}
            >
              {(tab === "listings" ? STATUS_OPTIONS : REQUEST_STATUS_OPTIONS).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}

        <span className={s.count}>
          {count} {tab === "accounts" ? "accounts" : tab === "requests" ? "requests" : "listings"}
        </span>
      </form>

      {error && <div className={s.error}>{error}</div>}

      {loading ? (
        <div className={s.list} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={s.placeholder} />
          ))}
        </div>
      ) : tab === "listings" ? (
        listings && listings.length > 0 ? (
          <div className={s.list}>
            {listings.map((listing) => {
              const photo = listing.photos_small?.[0] || listing.photos?.[0];
              return (
                <div key={listing.id} className={s.row}>
                  {photo ? (
                    <img className={s.thumb} src={photo} alt="" loading="lazy" />
                  ) : (
                    <div className={`${s.thumb} ${s.thumbEmpty}`} aria-hidden="true" />
                  )}

                  <div className={s.rowMain}>
                    <p className={s.rowTitle}>{listing.name}</p>
                    <p className={s.rowMeta}>
                      ${listing.price.toLocaleString()} · {listing.category} ·{" "}
                      {listing.seller?.display_name ?? "Unknown seller"} ·{" "}
                      {formatRelativeTime(listing.created_at)}
                    </p>
                    {listing.flag_reason && <p className={s.rowReason}>{listing.flag_reason}</p>}
                  </div>

                  <div className={s.rowTags}>
                    <span
                      className={`${s.badge} ${
                        listing.status === "flagged"
                          ? s.badgeFlagged
                          : listing.status === "sold"
                            ? s.badgeMuted
                            : s.badgeActive
                      }`}
                    >
                      {listing.status}
                    </span>
                    {listing.report_count > 0 && (
                      <span className={`${s.badge} ${s.badgeFlagged}`}>
                        <Flag size={11} /> {listing.report_count}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className={s.deleteBtn}
                    disabled={busyId === listing.id}
                    onClick={() => removeListing(listing)}
                  >
                    <Trash2 size={14} />
                    {busyId === listing.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={s.empty}>
            <ShoppingBag size={40} className={s.emptyIcon} />
            <p className={s.emptyTitle}>No listings match</p>
            <p className={s.emptyBody}>Try a different search or status filter.</p>
          </div>
        )
      ) : tab === "requests" ? (
        requests && requests.length > 0 ? (
          <div className={s.list}>
            {requests.map((request) => (
              <div key={request.id} className={s.row}>
                <div className={s.rowMain}>
                  <p className={s.rowTitle}>{request.title}</p>
                  <p className={s.rowMeta}>
                    {budgetLabel(request)} · {request.requester?.display_name ?? "Unknown student"}{" "}
                    · {formatRelativeTime(request.created_at)}
                  </p>
                </div>

                <div className={s.rowTags}>
                  <span
                    className={`${s.badge} ${
                      request.status === "active" ? s.badgeActive : s.badgeMuted
                    }`}
                  >
                    {request.status}
                  </span>
                </div>

                <button
                  type="button"
                  className={s.deleteBtn}
                  disabled={busyId === request.id}
                  onClick={() => removeRequest(request)}
                >
                  <Trash2 size={14} />
                  {busyId === request.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={s.empty}>
            <Megaphone size={40} className={s.emptyIcon} />
            <p className={s.emptyTitle}>No requests match</p>
            <p className={s.emptyBody}>Try a different search or status filter.</p>
          </div>
        )
      ) : accounts && accounts.length > 0 ? (
        <div className={s.list}>
          {accounts.map((account) => (
            <div key={account.id} className={s.row}>
              <div className={s.rowMain}>
                <p className={s.rowTitle}>{account.display_name}</p>
                <p className={s.rowMeta}>
                  {account.email || "No email on file"}
                  {account.school_year ? ` · ${account.school_year}` : ""} ·{" "}
                  {account.listing_count} {account.listing_count === 1 ? "listing" : "listings"}
                </p>
              </div>

              <div className={s.rowTags}>
                {account.is_admin && <span className={`${s.badge} ${s.badgeActive}`}>admin</span>}
                {!account.email_verified && (
                  <span className={`${s.badge} ${s.badgeMuted}`}>unverified</span>
                )}
              </div>

              {account.id === me?.id ? (
                <span className={s.selfLabel}>You</span>
              ) : (
                <button
                  type="button"
                  className={s.deleteBtn}
                  disabled={busyId === account.id}
                  onClick={() => removeAccount(account)}
                >
                  <Trash2 size={14} />
                  {busyId === account.id ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={s.empty}>
          <Users size={40} className={s.emptyIcon} />
          <p className={s.emptyTitle}>No accounts match</p>
          <p className={s.emptyBody}>Try a different search.</p>
        </div>
      )}
    </div>
  );
}
