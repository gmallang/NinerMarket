import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useMarketStore } from "@/lib/store";
import type { WantedRequestDto, WantedRequestStatus } from "@/lib/types";
import { RequestCard } from "@/components/requests/RequestCard";
import s from "./RequestsPage.module.css";
import ps from "./page.module.css";

type Tab = WantedRequestStatus | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "fulfilled", label: "Fulfilled" },
  { id: "expired", label: "Expired" },
  { id: "all", label: "All" },
];

export function MyRequestsPage() {
  const user = useMarketStore((state) => state.user);
  const requestsVersion = useMarketStore((state) => state.requestsVersion);
  const markRequestsChanged = useMarketStore((state) => state.markRequestsChanged);
  const openRequestForm = useMarketStore((state) => state.openRequestForm);
  const openEditRequest = useMarketStore((state) => state.openEditRequest);

  const [tab, setTab] = useState<Tab>("active");
  const [requests, setRequests] = useState<WantedRequestDto[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api
      .getUserRequests(user.id, "all")
      .then((list) => {
        if (!alive) return;
        setRequests(list);
        setError("");
      })
      .catch((err) => {
        if (!alive) return;
        setRequests([]);
        setError(err instanceof Error ? err.message : "Couldn't load your requests");
      });
    return () => {
      alive = false;
    };
  }, [user, requestsVersion]);

  const replace = (next: WantedRequestDto) =>
    setRequests((list) => list?.map((r) => (r.id === next.id ? next : r)) ?? list);

  const changeStatus = async (request: WantedRequestDto, status: "active" | "fulfilled") => {
    setBusyId(request.id);
    try {
      const next = await api.updateRequest(request.id, { status });
      replace(next);
      markRequestsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the request");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (request: WantedRequestDto) => {
    if (!window.confirm(`Delete "${request.title}"? This can't be undone.`)) return;
    setBusyId(request.id);
    try {
      await api.deleteRequest(request.id);
      setRequests((list) => list?.filter((r) => r.id !== request.id) ?? list);
      markRequestsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the request");
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    active: requests?.filter((r) => r.status === "active").length ?? 0,
    fulfilled: requests?.filter((r) => r.status === "fulfilled").length ?? 0,
    expired: requests?.filter((r) => r.status === "expired").length ?? 0,
    all: requests?.length ?? 0,
  };

  const visible = requests?.filter((r) => tab === "all" || r.status === tab) ?? null;

  return (
    <div className={ps.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>My Requests</h1>
          <p className={s.subtitle}>
            Everything you've asked the campus for. Edit, mark fulfilled, reopen, or remove them
            here.
          </p>
        </div>
        <div className={s.headerActions}>
          <Link to="/requests" className={s.secondaryBtn}>
            Browse requests
          </Link>
          <button type="button" className={s.primaryBtn} onClick={openRequestForm}>
            <Plus size={15} /> Post a Request
          </button>
        </div>
      </div>

      <div className={s.tabs} role="tablist" aria-label="Request status">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`${s.tab} ${tab === t.id ? s.tabActive : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className={s.tabCount}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {error && <div className={s.error}>{error}</div>}

      {visible === null ? (
        <div className={s.grid} aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={s.placeholder} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className={s.empty}>
          <Search size={44} className={s.emptyIcon} />
          <p className={s.emptyTitle}>
            {tab === "active"
              ? "No active requests"
              : tab === "fulfilled"
                ? "Nothing fulfilled yet"
                : tab === "expired"
                  ? "No expired requests"
                  : "You haven't posted any requests"}
          </p>
          <p className={s.emptyBody}>
            Post what you're looking for and let fellow Niners reach out.
          </p>
          <button type="button" className={s.primaryBtn} onClick={openRequestForm}>
            <Plus size={15} /> Post a Request
          </button>
        </div>
      ) : (
        <div className={s.grid}>
          {visible.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              currentUserId={user?.id}
              onEdit={busyId === request.id ? undefined : () => openEditRequest(request)}
              onDelete={busyId === request.id ? undefined : () => void remove(request)}
              onFulfill={() => void changeStatus(request, "fulfilled")}
              onReopen={() => void changeStatus(request, "active")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
