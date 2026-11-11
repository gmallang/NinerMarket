import { useEffect, useState } from "react";
import {
  Check,
  Flag,
  History,
  Megaphone,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { useMarketStore } from "@/lib/store";
import type {
  AdminAuditEntry,
  AdminListing,
  AdminRating,
  AdminReport,
  AdminUser,
  WantedRequestDto,
} from "@/lib/types";
import s from "./AdminPage.module.css";
import ps from "./page.module.css";

type Tab = "listings" | "requests" | "reports" | "ratings" | "accounts" | "deleted" | "audit";

const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: "listings", label: "Listings", icon: ShoppingBag },
  { id: "requests", label: "Requests", icon: Megaphone },
  { id: "reports", label: "Reports", icon: Flag },
  { id: "ratings", label: "Ratings", icon: Star },
  { id: "accounts", label: "Accounts", icon: Users },
  { id: "deleted", label: "Deleted", icon: RotateCcw },
  { id: "audit", label: "Audit", icon: History },
];

const NOUNS: Record<Tab, string> = {
  listings: "listings",
  requests: "requests",
  reports: "reports",
  ratings: "ratings",
  accounts: "accounts",
  deleted: "deleted accounts",
  audit: "actions",
};

const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  listings: "Search by title or text…",
  requests: "Search by title or text…",
  reports: "Search by reason, listing or reporter…",
  ratings: "Search by comment or name…",
  accounts: "Search by name or email…",
  deleted: "Search by name or email…",
  audit: "Search action, target or admin…",
};

const STATUS_OPTIONS = ["all", "pending", "active", "sold", "flagged"];
const REQUEST_STATUS_OPTIONS = ["all", "active", "fulfilled", "expired"];
const REPORT_STATUS_OPTIONS = ["open", "dismissed", "upheld", "all"];

function budgetLabel(request: WantedRequestDto): string {
  const { budget_min: min, budget_max: max } = request;
  if (min != null && max != null) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (min != null) return `From $${min.toLocaleString()}`;
  if (max != null) return `Up to $${max.toLocaleString()}`;
  return "No budget given";
}

function reportBadge(status: AdminReport["status"]): string {
  if (status === "open") return s.badgePending;
  if (status === "upheld") return s.badgeFlagged;
  return s.badgeMuted;
}

export function AdminPage() {
  const me = useMarketStore((state) => state.user);

  const [tab, setTab] = useState<Tab>("listings");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [listings, setListings] = useState<AdminListing[] | null>(null);
  const [requests, setRequests] = useState<WantedRequestDto[] | null>(null);
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [ratings, setRatings] = useState<AdminRating[] | null>(null);
  const [accounts, setAccounts] = useState<AdminUser[] | null>(null);
  const [deletedAccounts, setDeletedAccounts] = useState<AdminUser[] | null>(null);
  const [audit, setAudit] = useState<AdminAuditEntry[] | null>(null);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Clears one section back to its loading state. Called from the handlers
  // that change what we're looking at — not from inside the effect, which
  // must not set state synchronously.
  const clearTab = (target: Tab) => {
    if (target === "listings") setListings(null);
    else if (target === "requests") setRequests(null);
    else if (target === "reports") setReports(null);
    else if (target === "ratings") setRatings(null);
    else if (target === "accounts") setAccounts(null);
    else if (target === "deleted") setDeletedAccounts(null);
    else setAudit(null);
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
        } else if (tab === "reports") {
          const page = await api.adminListReports({ q: query, status });
          if (!alive) return;
          setReports(page.items);
          setTotal(page.total);
        } else if (tab === "ratings") {
          const page = await api.adminListRatings({ q: query });
          if (!alive) return;
          setRatings(page.items);
          setTotal(page.total);
        } else if (tab === "accounts") {
          const page = await api.adminListUsers({ q: query });
          if (!alive) return;
          setAccounts(page.items);
          setTotal(page.total);
        } else if (tab === "deleted") {
          const page = await api.adminListUsers({ q: query, deleted: true });
          if (!alive) return;
          setDeletedAccounts(page.items);
          setTotal(page.total);
        } else {
          const page = await api.adminListAudit({ q: query });
          if (!alive) return;
          setAudit(page.items);
          setTotal(page.total);
        }
      } catch (err) {
        if (!alive) return;
        if (tab === "listings") setListings([]);
        else if (tab === "requests") setRequests([]);
        else if (tab === "reports") setReports([]);
        else if (tab === "ratings") setRatings([]);
        else if (tab === "accounts") setAccounts([]);
        else if (tab === "deleted") setDeletedAccounts([]);
        else setAudit([]);
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

  const run = async (
    id: string,
    action: () => Promise<unknown>,
    onDone: () => void,
    decrement = true,
  ) => {
    setBusyId(id);
    setError("");
    try {
      await action();
      onDone();
      if (decrement) {
        setTotal((current) => (current == null ? current : Math.max(0, current - 1)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update that — try again.");
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

  const removeRating = (rating: AdminRating) => {
    if (
      !window.confirm(
        `Delete this ${rating.stars}-star rating? The seller's average will be recalculated. This can't be undone.`,
      )
    ) {
      return;
    }
    void run(rating.id, () => api.adminDeleteRating(rating.id), () =>
      setRatings((list) => list?.filter((item) => item.id !== rating.id) ?? list),
    );
  };

  const approveListing = (listing: AdminListing) => {
    void run(
      listing.id,
      () => api.adminApproveListing(listing.id),
      () =>
        setListings((list) => {
          if (!list) return list;
          // Approved rows no longer match a pending/flagged filter.
          if (status === "pending" || status === "flagged") {
            return list.filter((item) => item.id !== listing.id);
          }
          return list.map((item) =>
            item.id === listing.id ? { ...item, status: "active", flag_reason: "" } : item,
          );
        }),
      false,
    );
  };

  const dismissReport = (report: AdminReport) => {
    if (
      !window.confirm(
        "Dismiss this report? The listing stays up. If it was hidden only because of reports, it goes live again.",
      )
    ) {
      return;
    }
    void run(
      report.id,
      () => api.adminDismissReport(report.id),
      () =>
        setReports((list) => {
          if (!list) return list;
          if (status === "open") return list.filter((item) => item.id !== report.id);
          return list.map((item) =>
            item.id === report.id ? { ...item, status: "dismissed" } : item,
          );
        }),
      status === "open",
    );
  };

  const upholdReport = (report: AdminReport) => {
    if (
      !window.confirm(
        `Remove "${report.listing?.name ?? "this listing"}"? The seller will be notified and the listing can't be restored.`,
      )
    ) {
      return;
    }
    void run(report.id, () => api.adminUpholdReport(report.id), () =>
      setReports((list) => list?.filter((item) => item.id !== report.id) ?? list),
    );
  };

  const toggleAccountFlag = (account: AdminUser) => {
    if (!account.posting_flagged) {
      const reason = window.prompt(
        `Flag ${account.display_name}? Every new listing they post will need admin approval.`,
        "Repeated listings that broke the marketplace rules",
      );
      if (reason === null) return;
      void run(
        account.id,
        () => api.adminFlagUser(account.id, true, reason.trim()),
        () =>
          setAccounts((list) =>
            list?.map((item) =>
              item.id === account.id
                ? { ...item, posting_flagged: true, flag_reason: reason.trim() }
                : item,
            ) ?? list,
          ),
        false,
      );
      return;
    }

    if (!window.confirm(`Remove the review flag from ${account.display_name}?`)) return;
    void run(
      account.id,
      () => api.adminFlagUser(account.id, false),
      () =>
        setAccounts((list) =>
          list?.map((item) =>
            item.id === account.id
              ? { ...item, posting_flagged: false, flag_reason: "", bad_listing_streak: 0 }
              : item,
          ) ?? list,
        ),
      false,
    );
  };

  const removeAccount = (account: AdminUser) => {
    if (
      !window.confirm(
        `Close ${account.display_name}'s account? Their listings and requests are hidden right away. You can restore it from the Deleted tab.`,
      )
    ) {
      return;
    }
    void run(account.id, () => api.adminDeleteUser(account.id), () =>
      setAccounts((list) => list?.filter((item) => item.id !== account.id) ?? list),
    );
  };

  const restoreAccount = (account: AdminUser) => {
    if (
      !window.confirm(
        `Restore ${account.display_name}'s account? They can sign in again and their listings and requests become visible.`,
      )
    ) {
      return;
    }
    void run(account.id, () => api.adminRestoreUser(account.id), () =>
      setDeletedAccounts((list) => list?.filter((item) => item.id !== account.id) ?? list),
    );
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setStatus(next === "reports" ? "open" : "all");
    setQuery("");
    setDraft("");
    clearTab(next);
  };

  const loading =
    (tab === "listings" && listings === null) ||
    (tab === "requests" && requests === null) ||
    (tab === "reports" && reports === null) ||
    (tab === "ratings" && ratings === null) ||
    (tab === "accounts" && accounts === null) ||
    (tab === "deleted" && deletedAccounts === null) ||
    (tab === "audit" && audit === null);

  const count = total ?? 0;

  const statusOptions =
    tab === "listings"
      ? STATUS_OPTIONS
      : tab === "requests"
        ? REQUEST_STATUS_OPTIONS
        : REPORT_STATUS_OPTIONS;

  return (
    <div className={ps.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Admin panel</h1>
          <p className={s.subtitle}>
            Every listing, request, report, rating and account on NinerMarket. Work the report
            queue, approve pending posts, flag accounts, close accounts (reversible from the
            Deleted tab), and see who did what in the audit log.
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
            placeholder={SEARCH_PLACEHOLDER[tab]}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>

        {(tab === "listings" || tab === "requests" || tab === "reports") && (
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
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}

        <span className={s.count}>
          {count} {NOUNS[tab]}
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
                          : listing.status === "pending"
                            ? s.badgePending
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

                  <div className={s.rowActions}>
                    {(listing.status === "pending" || listing.status === "flagged") && (
                      <button
                        type="button"
                        className={s.approveBtn}
                        disabled={busyId === listing.id}
                        onClick={() => approveListing(listing)}
                      >
                        <Check size={14} />
                        {busyId === listing.id ? "Working…" : "Approve"}
                      </button>
                    )}
                    <button
                      type="button"
                      className={s.deleteBtn}
                      disabled={busyId === listing.id}
                      onClick={() => removeListing(listing)}
                    >
                      <Trash2 size={14} />
                      {busyId === listing.id ? "Working…" : "Delete"}
                    </button>
                  </div>
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
      ) : tab === "reports" ? (
        reports && reports.length > 0 ? (
          <div className={s.list}>
            {reports.map((report) => (
              <div key={report.id} className={s.row}>
                <div className={s.rowMain}>
                  <p className={s.rowTitle}>
                    {report.listing?.name ?? "Listing no longer exists"}
                  </p>
                  <p className={s.rowMeta}>
                    {report.reason} · reported by{" "}
                    {report.reporter?.display_name ?? "Former member"} ·{" "}
                    {formatRelativeTime(report.created_at)}
                  </p>
                  {report.details && <p className={s.detailText}>{report.details}</p>}
                </div>

                <div className={s.rowTags}>
                  <span className={`${s.badge} ${reportBadge(report.status)}`}>
                    {report.status}
                  </span>
                  {report.listing && (
                    <span className={`${s.badge} ${s.badgeMuted}`}>
                      listing {report.listing.status}
                    </span>
                  )}
                </div>

                {report.status === "open" ? (
                  <div className={s.rowActions}>
                    <button
                      type="button"
                      className={s.dismissBtn}
                      disabled={busyId === report.id}
                      onClick={() => dismissReport(report)}
                    >
                      {busyId === report.id ? "Working…" : "Dismiss"}
                    </button>
                    <button
                      type="button"
                      className={s.deleteBtn}
                      disabled={busyId === report.id}
                      onClick={() => upholdReport(report)}
                    >
                      <Trash2 size={14} />
                      {busyId === report.id ? "Working…" : "Remove listing"}
                    </button>
                  </div>
                ) : (
                  <span className={s.resolvedLabel}>resolved</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={s.empty}>
            <Flag size={40} className={s.emptyIcon} />
            <p className={s.emptyTitle}>No reports match</p>
            <p className={s.emptyBody}>
              Nothing needs a decision here — try the dismissed or upheld filter to review history.
            </p>
          </div>
        )
      ) : tab === "ratings" ? (
        ratings && ratings.length > 0 ? (
          <div className={s.list}>
            {ratings.map((rating) => (
              <div key={rating.id} className={s.row}>
                <div className={s.rowMain}>
                  <p className={s.rowTitle}>
                    {rating.rater?.display_name ?? "Former member"} →{" "}
                    {rating.ratee?.display_name ?? "Former member"}
                  </p>
                  <p className={s.rowMeta}>
                    {rating.stars}/5 stars · {formatRelativeTime(rating.created_at)}
                  </p>
                  {rating.comment && <p className={s.ratingComment}>{rating.comment}</p>}
                </div>

                <div className={s.rowTags}>
                  <span className={`${s.badge} ${s.badgeActive}`}>{rating.stars} ★</span>
                </div>

                <button
                  type="button"
                  className={s.deleteBtn}
                  disabled={busyId === rating.id}
                  onClick={() => removeRating(rating)}
                >
                  <Trash2 size={14} />
                  {busyId === rating.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={s.empty}>
            <Star size={40} className={s.emptyIcon} />
            <p className={s.emptyTitle}>No ratings match</p>
            <p className={s.emptyBody}>Try a different search.</p>
          </div>
        )
      ) : tab === "accounts" ? (
        accounts && accounts.length > 0 ? (
          <div className={s.list}>
            {accounts.map((account) => (
              <div key={account.id} className={s.row}>
                <div className={s.rowMain}>
                  <p className={s.rowTitle}>{account.display_name}</p>
                  <p className={s.rowMeta}>
                    {account.email || "No email on file"}
                    {account.school_year ? ` · ${account.school_year}` : ""} ·{" "}
                    {account.listing_count}{" "}
                    {account.listing_count === 1 ? "listing" : "listings"}
                  </p>
                  {account.posting_flagged && account.flag_reason && (
                    <p className={s.rowReason}>{account.flag_reason}</p>
                  )}
                </div>

                <div className={s.rowTags}>
                  {account.is_admin && (
                    <span className={`${s.badge} ${s.badgeActive}`}>admin</span>
                  )}
                  {account.posting_flagged && (
                    <span className={`${s.badge} ${s.badgeFlagged}`}>flagged</span>
                  )}
                  {(account.bad_listing_streak ?? 0) > 0 && (
                    <span className={`${s.badge} ${s.badgeMuted}`}>
                      {account.bad_listing_streak} strike
                      {account.bad_listing_streak === 1 ? "" : "s"}
                    </span>
                  )}
                  {!account.email_verified && (
                    <span className={`${s.badge} ${s.badgeMuted}`}>unverified</span>
                  )}
                </div>

                {account.id === me?.id ? (
                  <span className={s.selfLabel}>You</span>
                ) : (
                  <div className={s.rowActions}>
                    <button
                      type="button"
                      className={s.flagBtn}
                      disabled={busyId === account.id}
                      onClick={() => toggleAccountFlag(account)}
                    >
                      <Flag size={14} />
                      {account.posting_flagged ? "Unflag" : "Flag"}
                    </button>
                    <button
                      type="button"
                      className={s.deleteBtn}
                      disabled={busyId === account.id}
                      onClick={() => removeAccount(account)}
                    >
                      <Trash2 size={14} />
                      {busyId === account.id ? "Working…" : "Close"}
                    </button>
                  </div>
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
        )
      ) : tab === "deleted" ? (
        deletedAccounts && deletedAccounts.length > 0 ? (
          <div className={s.list}>
            {deletedAccounts.map((account) => (
              <div key={account.id} className={s.row}>
                <div className={s.rowMain}>
                  <p className={s.rowTitle}>{account.display_name}</p>
                  <p className={s.rowMeta}>
                    {account.email || "No email on file"} · closed{" "}
                    {account.deleted_at
                      ? formatRelativeTime(account.deleted_at)
                      : "recently"}{" "}
                    · {account.listing_count}{" "}
                    {account.listing_count === 1 ? "listing" : "listings"} hidden
                  </p>
                </div>

                <div className={s.rowTags}>
                  <span className={`${s.badge} ${s.badgeMuted}`}>closed</span>
                </div>

                <button
                  type="button"
                  className={s.approveBtn}
                  disabled={busyId === account.id}
                  onClick={() => restoreAccount(account)}
                >
                  <RotateCcw size={14} />
                  {busyId === account.id ? "Restoring…" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={s.empty}>
            <RotateCcw size={40} className={s.emptyIcon} />
            <p className={s.emptyTitle}>No closed accounts</p>
            <p className={s.emptyBody}>
              Closed accounts stay here until you restore them, so closing one from the
              Accounts tab can always be undone.
            </p>
          </div>
        )
      ) : audit && audit.length > 0 ? (
        <div className={s.list}>
          {audit.map((entry) => (
            <div key={entry.id} className={s.row}>
              <div className={s.rowMain}>
                <p className={s.rowTitle}>
                  <span className={s.auditAction}>{entry.action}</span>
                  {entry.target_label || entry.target_id || entry.target_type}
                </p>
                <p className={s.rowMeta}>
                  {entry.admin_email || entry.admin_id} ·{" "}
                  {formatRelativeTime(entry.created_at)}
                </p>
                {entry.details && <p className={s.detailText}>{entry.details}</p>}
              </div>

              <div className={s.rowTags}>
                <span className={`${s.badge} ${s.badgeMuted}`}>{entry.target_type}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={s.empty}>
          <History size={40} className={s.emptyIcon} />
          <p className={s.emptyTitle}>No admin actions yet</p>
          <p className={s.emptyBody}>
            Every remove, approve, flag and restore is recorded here with the moderator's
            email.
          </p>
        </div>
      )}
    </div>
  );
}
