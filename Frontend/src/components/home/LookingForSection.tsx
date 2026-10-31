import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useMarketStore } from "@/lib/store";
import type { WantedRequestDto } from "@/lib/types";
import { RequestCard } from "@/components/requests/RequestCard";
import s from "./LookingForSection.module.css";

const FEED_SIZE = 3;

/** Homepage teaser for the public "Looking For" feed. */
export function LookingForSection() {
  const user = useMarketStore((state) => state.user);
  const requestsVersion = useMarketStore((state) => state.requestsVersion);
  const openRequestForm = useMarketStore((state) => state.openRequestForm);
  const respondToRequest = useMarketStore((state) => state.respondToRequest);

  const [requests, setRequests] = useState<WantedRequestDto[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listRequests({ status: "active", limit: FEED_SIZE })
      .then(({ items, total: count }) => {
        if (!alive) return;
        setRequests(items);
        setTotal(count ?? items.length);
      })
      .catch(() => {
        if (alive) setRequests([]);
      });
    return () => {
      alive = false;
    };
  }, [requestsVersion]);

  const respond = async (request: WantedRequestDto) => {
    setPendingId(request.id);
    try {
      await respondToRequest(request);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className={s.section} aria-labelledby="looking-for-title" id="looking-for">
      <div className={s.header}>
        <div className={s.titleWrap}>
          <h2 className={s.title} id="looking-for-title">
            Looking For
          </h2>
          <p className={s.subtitle}>
            Can't find what you need? See what fellow Niners are searching for.
          </p>
        </div>
        <div className={s.headerActions}>
          <Link to="/requests" className={s.viewAll}>
            Browse all requests{total != null && total > 0 ? ` (${total})` : ""}
          </Link>
          <button type="button" className={s.postBtn} onClick={openRequestForm}>
            <Plus size={15} /> Post a Request
          </button>
        </div>
      </div>

      {requests === null ? (
        <div className={s.placeholderRow} aria-hidden="true">
          {Array.from({ length: FEED_SIZE }).map((_, i) => (
            <div key={i} className={s.placeholder} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className={s.empty}>
          <p className={s.emptyTitle}>No open requests right now</p>
          <p className={s.emptyBody}>
            Be the first — tell the campus what you're looking for and let other Niners help.
          </p>
          <button type="button" className={s.postBtn} onClick={openRequestForm}>
            <Plus size={15} /> Post a Request
          </button>
        </div>
      ) : (
        <div className={s.grid}>
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              currentUserId={user?.id}
              respondPending={pendingId === request.id}
              onRespond={() => void respond(request)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
