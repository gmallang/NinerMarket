import { create } from "zustand";
import type { Conversation } from "@/data/conversations";
import { api, clearToken } from "@/lib/api";
import { avatarUrl } from "@/lib/avatar";
import { fromDto } from "@/lib/listings";
import { broadcastTyping, subscribeInbox, subscribeListings } from "@/lib/realtime";
import { clearUser, loadUser, saveUser } from "@/lib/user";
import type { CurrentUser, Listing, NotificationDto } from "@/lib/types";

const SAVED_KEY = "ninermarket-saved";
const THREADS_KEY = "ninermarket-threads";

function loadThreadsCache(): Conversation[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function persistThreadsCache(convs: Conversation[]): void {
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(convs));
  } catch {
    // ignore storage errors
  }
}

// Realtime subscription + typing-timeout handles live outside the store's
// reactive state — components never need to read them directly.
let unsubscribeInbox: (() => void) | null = null;
let unsubscribeListings: (() => void) | null = null;
const typingTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

function loadSaved(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function latestMsgId(conv: Conversation): number {
  return conv.messages.reduce((maxId, m) => Math.max(maxId, m.id), 0);
}

function persistSaved(items: Set<string>): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...items]));
  } catch {
    // ignore storage errors
  }
}

interface MarketState {
  user: CurrentUser | null;
  listings: Listing[];
  loading: boolean;
  listingsError: string | null;
  savedItems: Set<string>;
  convs: Conversation[];
  threadsLoading: boolean;
  activeConvId: number;
  inputText: string;
  notifications: NotificationDto[];
  typingByConvId: Record<number, boolean>;

  signIn: (user: CurrentUser) => void;
  logout: () => void;
  startRealtimeInbox: () => void;
  stopRealtimeInbox: () => void;
  startRealtimeListings: () => void;
  stopRealtimeListings: () => void;
  sendTypingSignal: (isTyping: boolean) => void;
  updateProfile: (year: string, payments: string[]) => Promise<void>;
  refreshProfile: () => Promise<void>;
  loadListings: (silent?: boolean) => Promise<void>;
  addListing: (listing: Listing) => void;
  updateListing: (listing: Listing) => void;
  sellModal: { mode: "create" } | { mode: "edit"; listing: Listing } | null;
  openSellForm: () => void;
  openEditListing: (listing: Listing) => void;
  closeSellForm: () => void;
  toggleSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  setActiveConvId: (id: number) => void;
  setInputText: (text: string) => void;
  sendMessage: () => void;
  openConversationForListing: (listingId: string) => void;
  openConversationWithBuyer: (listingId: string, buyerId: string, buyerName: string) => void;
  loadThreads: () => Promise<void>;
  refreshThread: (threadId: number) => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  messagesOpen: boolean;
  openMessagesOverlay: () => void;
  openMessageOverlay: (listingId: string) => void;
  openMessageOverlayWithBuyer: (listingId: string, buyerId: string, buyerName: string) => void;
  closeMessagesOverlay: () => void;
  listingOverlayId: string | null;
  openListingOverlay: (listingId: string) => void;
  closeListingOverlay: () => void;
  markListingSold: (listingId: string) => Promise<void>;
  reportListing: (listingId: string, reason: string, details: string) => Promise<void>;
  makeOffer: (listingId: string, price: number) => Promise<void>;
}

export const useMarketStore = create<MarketState>((set, get) => {
  const state: MarketState = {
  user: loadUser(),
  listings: [],
  loading: true,
  listingsError: null,
  savedItems: loadSaved(),
  convs: loadThreadsCache(),
  threadsLoading: false,
  activeConvId: 1,
  inputText: "",
  notifications: [],
  typingByConvId: {},
  messagesOpen: false,
  listingOverlayId: null,
  sellModal: null,

  signIn: (user) => {
    set({ user });
    void get().loadNotifications();
    void get().loadThreads();
  },
  logout: () => {
    clearUser();
    clearToken();
    get().stopRealtimeInbox();
    get().stopRealtimeListings();
    try {
      localStorage.removeItem(THREADS_KEY);
    } catch {
      // ignore storage errors
    }
    set({ user: null, convs: [], activeConvId: 1 });
  },

  startRealtimeInbox: () => {
    const user = get().user;
    if (!user) return;
    unsubscribeInbox?.();
    unsubscribeInbox = subscribeInbox(user.id, {
      onNewMessage: (payload) => void get().refreshThread(payload.thread_id),
      onTyping: (payload) => {
        if (payload.user_id === user.id) return;
        set((state) => ({
          typingByConvId: { ...state.typingByConvId, [payload.thread_id]: payload.typing },
        }));
        const existing = typingTimeouts.get(payload.thread_id);
        if (existing) clearTimeout(existing);
        if (payload.typing) {
          typingTimeouts.set(
            payload.thread_id,
            setTimeout(() => {
              set((state) => ({
                typingByConvId: { ...state.typingByConvId, [payload.thread_id]: false },
              }));
            }, 3000)
          );
        }
      },
    });
  },

  refreshThread: async (threadId) => {
    const user = get().user;
    if (!user) return;
    try {
      const thread = await api.getThread(user.id, threadId);
      set((state) => {
        const isViewed = state.messagesOpen && state.activeConvId === threadId;
        const normalized = isViewed ? { ...thread, unread: 0 } : thread;
        const exists = state.convs.some((c) => c.id === threadId);
        const convs = exists
          ? state.convs.map((c) => (c.id === threadId ? normalized : c))
          : [normalized, ...state.convs];
        const activeConvId = convs.some((c) => c.id === state.activeConvId)
          ? state.activeConvId
          : convs[0]?.id ?? state.activeConvId;
        return { convs, activeConvId };
      });
      // If the recipient currently has this conversation open, they've seen
      // it — advance their read cursor so no badge appears for it.
      if (get().messagesOpen && get().activeConvId === threadId) {
        void api.markThreadRead(user.id, threadId, latestMsgId(thread)).catch(() => {});
      }
    } catch {
      // fall back to a full reload if the targeted fetch fails for any reason
      void get().loadThreads();
    }
  },

  stopRealtimeInbox: () => {
    unsubscribeInbox?.();
    unsubscribeInbox = null;
    for (const t of typingTimeouts.values()) clearTimeout(t);
    typingTimeouts.clear();
  },

  startRealtimeListings: () => {
    unsubscribeListings?.();
    unsubscribeListings = subscribeListings({
      onChanged: () => void get().loadListings(true),
    });
  },

  stopRealtimeListings: () => {
    unsubscribeListings?.();
    unsubscribeListings = null;
  },

  sendTypingSignal: (isTyping) => {
    const { user, convs, activeConvId } = get();
    if (!user) return;
    const conv = convs.find((c) => c.id === activeConvId);
    if (!conv?.other_user_id) return;
    broadcastTyping(conv.other_user_id, {
      thread_id: activeConvId,
      user_id: user.id,
      typing: isTyping,
    });
  },

  updateProfile: async (year, payments) => {
    const user = get().user;
    if (!user) return;
    const dto = await api.updateUser(user.id, { school_year: year, payment_methods: payments });
    const updated: CurrentUser = {
      ...user,
      school_year: dto.school_year,
      payment_methods: dto.payment_methods,
    };
    saveUser(updated);
    set({ user: updated });
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const u = await api.getUser(user.id);
      const updated: CurrentUser = {
        ...user,
        display_name: u.display_name,
        school_year: u.school_year,
        payment_methods: u.payment_methods,
        email_verified: u.email_verified ?? true,
      };
      saveUser(updated);
      set({ user: updated });
    } catch {
      // backend unreachable — keep the cached user
    }
  },

  loadListings: async (silent?: boolean) => {
    if (!get().user) return;
    if (!silent) set({ loading: true });
    try {
      const dtos = await api.listListings();
      set({ listings: dtos.map(fromDto), loading: false, listingsError: null });
    } catch (err) {
      if (silent) return;
      const message = err instanceof Error ? err.message : "Failed to load listings";
      set({ loading: false, listingsError: message });
    }
  },

  addListing: (listing) => set((state) => ({ listings: [listing, ...state.listings] })),

  updateListing: (listing) =>
    set((state) => ({
      listings: state.listings.map((l) => (l.id === listing.id ? listing : l)),
    })),

  openSellForm: () => set({ sellModal: { mode: "create" } }),

  openEditListing: (listing) => set({ sellModal: { mode: "edit", listing } }),

  closeSellForm: () => set({ sellModal: null }),

  toggleSave: (id) =>
    set((state) => {
      const next = new Set(state.savedItems);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistSaved(next);
      return { savedItems: next };
    }),

  isSaved: (id) => get().savedItems.has(id),

  setActiveConvId: (id) => {
    const user = get().user;
    const conv = get().convs.find((c) => c.id === id);
    set((state) => ({
      activeConvId: id,
      convs: state.convs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    }));
    if (user && conv) void api.markThreadRead(user.id, id, latestMsgId(conv)).catch(() => {});
  },

  setInputText: (inputText) => set({ inputText }),

  sendMessage: () => {
    const { inputText, activeConvId, user } = get();
    const text = inputText.trim();
    if (!text) return;
    const newMsg = { id: Date.now(), text, sent: true, timestamp: new Date().toISOString() };
    set((state) => ({
      convs: state.convs.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              lastMsg: text,
              lastTimestamp: newMsg.timestamp,
              unread: 0,
            }
          : c
      ),
      inputText: "",
    }));
    if (user) {
      void api
        .sendThreadMessage(user.id, activeConvId, text)
        .then((thread) =>
          set((state) => ({
            convs: state.convs.map((c) => (c.id === thread.id ? thread : c)),
          }))
        )
        .catch(() => {});
    }
  },

  openConversationForListing: (listingId) => {
    const { convs, listings, user } = get();
    const existing = convs.find((c) => c.listingId === listingId);
    if (existing) {
      set({ activeConvId: existing.id });
      if (user) void api.markThreadRead(user.id, existing.id, latestMsgId(existing)).catch(() => {});
      return;
    }
    const listing = listings.find((l) => l.id === listingId);
    if (!listing) return;
    const newConv: Conversation = {
      id: convs.length + 10,
      listingId,
      name: listing.seller,
      avatar: avatarUrl(listing.seller, 80),
      online: Math.random() > 0.5,
      unread: 0,
      lastMsg: "",
      lastTimestamp: new Date().toISOString(),
      messages: [],
    };
    set((state) => ({ convs: [newConv, ...state.convs], activeConvId: newConv.id }));
    if (user) {
      void api
        .openThread(user.id, listingId)
        .then((thread) =>
          set((state) => ({
            convs: state.convs.map((c) => (c.id === newConv.id ? thread : c)),
            activeConvId: state.activeConvId === newConv.id ? thread.id : state.activeConvId,
          }))
        )
        .catch(() => {});
    }
  },

  openConversationWithBuyer: (listingId, buyerId, buyerName) => {
    const { convs, user } = get();
    const existing = convs.find((c) => c.listingId === listingId && c.other_user_id === buyerId);
    if (existing) {
      set({ activeConvId: existing.id });
      if (user) void api.markThreadRead(user.id, existing.id, latestMsgId(existing)).catch(() => {});
      return;
    }
    const newConv: Conversation = {
      id: convs.length + 10,
      listingId,
      name: buyerName,
      avatar: avatarUrl(buyerName, 80),
      online: false,
      unread: 0,
      lastMsg: "",
      lastTimestamp: new Date().toISOString(),
      messages: [],
      other_user_id: buyerId,
    };
    set((state) => ({ convs: [newConv, ...state.convs], activeConvId: newConv.id }));
    if (user) {
      void api
        .openThread(user.id, listingId, buyerId)
        .then((thread) =>
          set((state) => ({
            convs: state.convs.map((c) => (c.id === newConv.id ? thread : c)),
            activeConvId: state.activeConvId === newConv.id ? thread.id : state.activeConvId,
          }))
        )
        .catch(() => {});
    }
  },

  loadThreads: async () => {
    const user = get().user;
    if (!user) return;
    set({ threadsLoading: true });
    try {
      const list = await api.getThreads(user.id);
      const { messagesOpen, activeConvId } = get();
      const active = list.find((c) => c.id === activeConvId);
      if (messagesOpen && active && active.unread > 0) {
        void api.markThreadRead(user.id, active.id, latestMsgId(active)).catch(() => {});
      }
      set((state) => {
        // A conversation just opened locally (e.g. from an offer notification
        // or "Message Seller") may not have finished being created on the
        // backend yet. Keep it instead of letting this refresh wipe it out —
        // it'll be replaced once its own create-thread call resolves, or
        // matched here on a later poll once the server catches up.
        const pending = state.convs.filter(
          (local) =>
            !list.some(
              (server) =>
                server.listingId === local.listingId &&
                (!local.other_user_id || server.other_user_id === local.other_user_id)
            )
        );
        const merged = [...pending, ...list];
        persistThreadsCache(merged);
        return {
          convs: messagesOpen
            ? merged.map((c) => (c.id === state.activeConvId ? { ...c, unread: 0 } : c))
            : merged,
          // activeConvId defaults to a placeholder that never corresponds to a
          // real thread. If it's still not pointing at anything real once
          // threads load, point it at the first one so sending a message
          // targets an actual conversation instead of a stale/bogus id.
          activeConvId: merged.some((c) => c.id === state.activeConvId)
            ? state.activeConvId
            : merged[0]?.id ?? state.activeConvId,
        };
      });
    } catch {
      // Keep whatever's already shown when the backend is unavailable.
    } finally {
      set({ threadsLoading: false });
    }
  },

  loadNotifications: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const list = await api.getNotifications(user.id);
      set({ notifications: list });
    } catch {
      // Keep whatever is already shown when the backend is unavailable.
    }
  },

  markNotificationRead: (id) => {
    const user = get().user;
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    if (user) void api.markNotificationRead(user.id, id).catch(() => {});
  },

  markAllNotificationsRead: () => {
    const user = get().user;
    const ids = get().notifications.map((n) => n.id);
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
    if (user) {
      for (const id of ids) void api.markNotificationRead(user.id, id).catch(() => {});
    }
  },

  clearNotifications: () => {
    const user = get().user;
    set({ notifications: [] });
    if (user) void api.clearNotifications(user.id).catch(() => {});
  },

  openMessageOverlay: (listingId) => {
    get().openConversationForListing(listingId);
    set({ messagesOpen: true });
    void get().loadThreads();
  },

  openMessageOverlayWithBuyer: (listingId, buyerId, buyerName) => {
    get().openConversationWithBuyer(listingId, buyerId, buyerName);
    set({ messagesOpen: true });
    void get().loadThreads();
  },

  openMessagesOverlay: () => {
    set({ messagesOpen: true });
    void get().loadThreads();
  },

  closeMessagesOverlay: () => set({ messagesOpen: false }),

  openListingOverlay: (listingId) => set({ listingOverlayId: listingId }),

  closeListingOverlay: () => set({ listingOverlayId: null }),

  markListingSold: async (listingId) => {
    await api.markListingSold(listingId);
    set((state) => ({
      listings: state.listings.map((l) => (l.id === listingId ? { ...l, status: "sold" } : l)),
    }));
  },

  reportListing: async (listingId, reason, details) => {
    const dto = await api.reportListing(listingId, reason, details);
    set((state) => ({
      listings: state.listings.map((l) => (l.id === listingId ? fromDto(dto) : l)),
    }));
  },

  makeOffer: async (listingId, price) => {
    await api.createOffer(listingId, price);
  },
  };

  if (state.user) {
    void get().loadThreads();
    void get().loadNotifications();
  }

  return state;
});
