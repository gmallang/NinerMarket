import { createClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const client =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export interface TypingPayload {
  thread_id: number;
  user_id: string;
  typing: boolean;
}

/** Subscribes to a user's personal inbox channel. Carries no message
 * content — just "something changed, go refetch" and typing pings — so it's
 * safe to leave as a public channel without minting Supabase auth tokens
 * for our own session-token-based auth. Returns an unsubscribe function. */
export function subscribeInbox(
  userId: string,
  handlers: {
    onNewMessage?: (payload: { thread_id: number }) => void;
    onTyping?: (payload: TypingPayload) => void;
  }
): () => void {
  if (!client || !userId) return () => {};

  const channel = client
    .channel(`inbox:${userId}`)
    .on("broadcast", { event: "new_message" }, ({ payload }) => {
      handlers.onNewMessage?.(payload as { thread_id: number });
    })
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      handlers.onTyping?.(payload as TypingPayload);
    })
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

/** Subscribes to a public "listings" channel. The backend broadcasts a
 * listing_changed event whenever a listing is created, edited, deleted,
 * flagged, or sold, so open tabs can refetch instead of waiting for a
 * manual refresh. Passes the listing id from the payload so callers can
 * do a targeted single-listing refresh instead of reloading all listings. */
export function subscribeListings(handlers: {
  onChanged?: (listingId?: string) => void;
}): () => void {
  if (!client) return () => {};

  const channel = client
    .channel("listings")
    .on("broadcast", { event: "listing_changed" }, ({ payload }) => {
      handlers.onChanged?.((payload as { id?: string }).id);
    })
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

// Outgoing channels used to send typing pings — kept open and reused per
// recipient rather than reconnecting on every keystroke, since broadcast
// sends need the channel to have actually finished joining first.
const outgoing = new Map<string, { channel: RealtimeChannel; ready: boolean }>();

function getOutgoingChannel(toUserId: string): { channel: RealtimeChannel; ready: boolean } | null {
  if (!client) return null;
  let entry = outgoing.get(toUserId);
  if (!entry) {
    const channel = client.channel(`inbox:${toUserId}`);
    entry = { channel, ready: false };
    outgoing.set(toUserId, entry);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && entry) entry.ready = true;
    });
  }
  return entry;
}

export function broadcastTyping(toUserId: string, payload: TypingPayload): void {
  if (!toUserId) return;
  const entry = getOutgoingChannel(toUserId);
  if (!entry?.ready) return;
  void entry.channel.send({ type: "broadcast", event: "typing", payload });
}
