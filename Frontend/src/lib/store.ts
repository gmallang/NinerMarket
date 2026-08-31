import { create } from "zustand";
import type { Conversation, Message } from "@/data/conversations";
import { api, clearToken } from "@/lib/api";
import { avatarUrl } from "@/lib/avatar";
import { fromDto } from "@/lib/listings";
import { broadcastTyping, subscribeInbox, subscribeListings } from "@/lib/realtime";
import { enablePush, getExistingPushSubscription } from "@/lib/push";
import { clearUser, loadUser, saveUser } from "@/lib/user";
import type { CurrentUser, Listing, NotificationDto } from "@/lib/types";

/**
 * Outcome of the Web Push opt-in so the UI can tell the user *why* it failed:
 *  - "ok"      -> subscribed and saved
 *  - "denied"  -> browser permission explicitly blocked
 *  - "nokey"   -> backend returned no VAPID public key (server misconfigured)
 *  - "failed"  -> registration/subscribe threw for another reason
 */
export type PushEnableResult = "ok" | "denied" | "nokey" | "failed";

function mergeThread(oldThread: Conversation | undefined, newThread: Conversation): Conversation {
  if (!oldThread) return newThread;

  // Do not let a response that started before a send erase a bubble that is
  // already visible locally. Match confirmed server messages back to their
  // browser identity so React keeps the same bubble mounted across refreshes.
  const trackedLocalMessages = oldThread.messages.filter((m) => m.isOptimistic || m.clientId);
  const serverMessages = [...newThread.messages];
  const matchedIndexes = new Set<number>();
  const localOnlyMessages: Message[] = [];

  for (const localMessage of trackedLocalMessages) {
    let matched = false;
    for (let i = serverMessages.length - 1; i >= 0; i--) {
      if (matchedIndexes.has(i)) continue;
      const serverMessage = serverMessages[i];
      if (serverMessage.sent === true && serverMessage.text === localMessage.text) {
        matchedIndexes.add(i);
        serverMessages[i] = {
          ...serverMessage,
          clientId: localMessage.clientId,
          isOptimistic: false,
        };
        matched = true;
        break;
      }
    }
    if (!matched) {
      localOnlyMessages.push(localMessage);
    }
  }

  const localLastMessage = oldThread.messages.at(-1);
  const serverLastTime = new Date(newThread.lastTimestamp).getTime();
  const keepLocalPreview =
    localLastMessage && new Date(localLastMessage.timestamp).getTime() > serverLastTime;

  return {
    ...newThread,
    ...(keepLocalPreview
      ? { lastMsg: oldThread.lastMsg, lastTimestamp: oldThread.lastTimestamp }
      : {}),
    messages: [...serverMessages, ...localOnlyMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ),
  };
}

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
let threadsLoadVersion = 0;
const threadMutationVersions = new Map<number, number>();

function markThreadMutated(threadId: number): number {
  const version = (threadMutationVersions.get(threadId) ?? 0) + 1;
  threadMutationVersions.set(threadId, version);
  return version;
}

function loadSavedLocal(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function latestMsgId(conv: Conversation): number {
  // Messages are always appended in chronological order, so the last element
  // has the highest id — no need to scan the entire array with reduce.
  return conv.messages.at(-1)?.id ?? 0;
}

function persistSavedLocal(items: Set<string>): void {
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
  pushEnabled: boolean;
  pushPromptDismissed: boolean;

  signIn: (user: CurrentUser) => void;
  logout: () => void;
  startRealtimeInbox: () => void;
  stopRealtimeInbox: () => void;
  startRealtimeListings: () => void;
  stopRealtimeListings: () => void;
  sendTypingSignal: (isTyping: boolean) => void;
  updateProfile: (year: string, payments: string[]) => Promise<void>;
  refreshProfile: () => Promise<void>;
  loadListings: (silent?: boolean, q?: string) => void;
  addListing: (listing: Listing) => void;
  updateListing: (listing: Listing) => void;
  sellModal: { mode: "create" } | { mode: "edit"; listing: Listing } | null;
  openSellForm: () => void;
  openEditListing: (listing: Listing) => void;
  closeSellForm: () => void;
  toggleSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  loadSaved: () => Promise<void>;
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
  checkPushEnabled: () => Promise<void>;
  enablePushNotifications: () => Promise<PushEnableResult>;
  dismissPushPrompt: () => void;
}

export const useMarketStore = create<MarketState>((set, get) => {
  const state: MarketState = {
  user: loadUser(),
  listings: [],
  loading: true,
  listingsError: null,
  savedItems: loadSavedLocal(),
  convs: loadThreadsCache(),
  threadsLoading: false,
  activeConvId: 1,
  inputText: "",
  notifications: [],
  typingByConvId: {},
  pushEnabled: false,
  pushPromptDismissed: false,
  messagesOpen: false,
  listingOverlayId: null,
  sellModal: null,

  signIn: (user) => {
    set({ user });
    void get().loadSaved();
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
    set({ user: null, convs: [], activeConvId: 1, savedItems: new Set() });
  },

  startRealtimeInbox: () => {
    const user = get().user;
    if (!user) return;
    unsubscribeInbox?.();
    unsubscribeInbox = subscribeInbox(user.id, {
      onNewMessage: (payload) => void get().refreshThread(payload.thread_id),
      onNewNotification: (notification) => {
        set((state) =>
          state.notifications.some((n) => n.id === notification.id)
            ? state
            : { notifications: [notification, ...state.notifications] }
        );
      },
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
          ? state.convs.map((c) => (c.id === threadId ? mergeThread(c, normalized) : c))
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
      onChanged: (listingId?: string) => {
        if (listingId) {
          // Refresh only the one listing that changed instead of reloading
          // the entire listings array on every broadcast event.
          void api.getListing(listingId).then((dto) => {
            const listing = fromDto(dto);
            const exists = get().listings.some((l) => l.id === listing.id);
            if (exists) {
              get().updateListing(listing);
            } else {
              get().addListing(listing);
            }
          }).catch(() => void get().loadListings(true));
        } else {
          void get().loadListings(true);
        }
      },
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
    } catch (err) {
      // The cached profile no longer exists on the backend (DB reset, account
      // deleted) — the session is a dead end, so log out instead of keeping
      // the ghost user around.
      if (err instanceof Error && err.message.includes("User not found")) {
        get().logout();
        return;
      }
      // backend unreachable — keep the cached user
    }
  },

  loadListings: (silent?: boolean, q?: string) => {
    if (!get().user) return;
    if (!silent) set({ loading: true });
    const params = q?.trim() ? { q: q.trim() } : {};
    return api
      .listListings(params)
      .then((dtos) => {
        set({ listings: dtos.map(fromDto), loading: false, listingsError: null });
      })
      .catch((err) => {
        if (silent) return;
        const message = err instanceof Error ? err.message : "Failed to load listings";
        set({ loading: false, listingsError: message });
      });
  },

  addListing: (listing) => set((state) => ({ listings: [listing, ...state.listings] })),

  updateListing: (listing) =>
    set((state) => ({
      listings: state.listings.map((l) => (l.id === listing.id ? listing : l)),
    })),

  openSellForm: () => set({ sellModal: { mode: "create" } }),

  openEditListing: (listing) => set({ sellModal: { mode: "edit", listing } }),

  closeSellForm: () => set({ sellModal: null }),

  toggleSave: (id) => {
    const user = get().user;
    const state = get();
    const nowSaved = !state.savedItems.has(id);

    // Optimistic update — flip the heart immediately, roll back if the API fails.
    set((s) => {
      const next = new Set(s.savedItems);
      if (nowSaved) next.add(id);
      else next.delete(id);
      return { savedItems: next };
    });

    if (!user) {
      // Not signed in — fall back to local-only so the UI still works, but
      // nothing is synced. (Real saves require an account.)
      return;
    }

    void (nowSaved ? api.saveListing(user.id, id) : api.unsaveListing(user.id, id)).catch(() => {
      // Roll back the optimistic update on failure.
      set((s) => {
        const next = new Set(s.savedItems);
        if (nowSaved) next.delete(id);
        else next.add(id);
        return { savedItems: next };
      });
    });
  },

  isSaved: (id) => get().savedItems.has(id),

  loadSaved: async () => {
    const user = get().user;
    if (!user) return;
    try {
      // First load for an account: fold any legacy localStorage-saved ids into
      // the server store (and sync back), then use the server as the source of
      // truth so saves follow the user across devices.
      const legacy = loadSavedLocal();
      if (legacy.size > 0) {
        const ids = await api.replaceSaved(user.id, [...legacy]);
        persistSavedLocal(new Set(ids));
        set({ savedItems: new Set(ids) });
        return;
      }
      const ids = await api.getSaved(user.id);
      set({ savedItems: new Set(ids) });
    } catch {
      // Keep whatever we already have if the backend is unavailable.
    }
  },

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

    markThreadMutated(activeConvId);
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticTimestamp = new Date().toISOString();
    const newMsg: Message & { clientId: string } = {
      id: Date.now(),
      clientId: optimisticId,
      text,
      sent: true,
      timestamp: optimisticTimestamp,
      isOptimistic: true,
    };
    set((state) => ({
      convs: state.convs.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              lastMsg: text,
              lastTimestamp: optimisticTimestamp,
              unread: 0,
            }
          : c
      ),
      inputText: "",
    }));

    if (!user) return;

    void api
      .sendThreadMessage(user.id, activeConvId, text)
      .then((thread) => {
        set((state) => ({
          convs: state.convs.map((c) => (c.id === thread.id ? mergeThread(c, thread) : c)),
        }));
      })
      .catch(() => {
        set((state) => ({
          convs: state.convs.map((conversation) => {
            if (conversation.id !== activeConvId) return conversation;
            const messages = conversation.messages.filter((m) => m.clientId !== optimisticId);
            const lastMessage = messages.at(-1);
            return {
              ...conversation,
              messages,
              lastMsg: lastMessage?.text ?? "",
              lastTimestamp: lastMessage?.timestamp ?? conversation.lastTimestamp,
            };
          }),
        }));
      });
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
    const loadVersion = ++threadsLoadVersion;
    set({ threadsLoading: true });
    try {
      const list = await api.getThreads(user.id);
      if (loadVersion !== threadsLoadVersion || get().user?.id !== user.id) return;
      const { messagesOpen, activeConvId } = get();
      const active = list.find((c) => c.id === activeConvId);
      if (messagesOpen && active && active.unread > 0) {
        void api.markThreadRead(user.id, active.id, latestMsgId(active)).catch(() => {});
      }
      set((state) => {
        // A conversation just opened locally (e.g. from an offer notification
        // or "Message Seller") may not have finished being created on the
        // backend yet. Keep it instead of letting this refresh wipe it out.
        const findLocal = (server: Conversation) =>
          state.convs.find(
            (local) =>
              local.listingId === server.listingId &&
              (!local.other_user_id || server.other_user_id === local.other_user_id)
          );
        const pending = state.convs.filter((local) => !list.some((server) => findLocal(server) === local));
        const merged = [...pending, ...list.map((server) => {
          const local = findLocal(server);
          const mutationVersion = threadMutationVersions.get(server.id) ?? 0;
          return mutationVersion > 0 && local ? mergeThread(local, server) : server;
        })];
        persistThreadsCache(merged);
        return {
          convs: messagesOpen
            ? merged.map((c) => (c.id === state.activeConvId ? { ...c, unread: 0 } : c))
            : merged,
          activeConvId: merged.some((c) => c.id === state.activeConvId)
            ? state.activeConvId
            : merged[0]?.id ?? state.activeConvId,
        };
      });
    } catch {
      // Keep whatever's already shown when the backend is unavailable.
    } finally {
      if (loadVersion === threadsLoadVersion) set({ threadsLoading: false });
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

  checkPushEnabled: async () => {
    const sub = await getExistingPushSubscription().catch(() => null);
    set({ pushEnabled: !!sub });
  },

  enablePushNotifications: async (): Promise<PushEnableResult> => {
    const user = get().user;
    if (!user) return "failed";
    try {
      const { key } = await api.getVapidPublicKey();
      if (!key) return "nokey";
      const subscription = await enablePush(key);
      if (!subscription) {
        return Notification.permission === "denied" ? "denied" : "failed";
      }
      await api.subscribePush(user.id, subscription.toJSON());
      set({ pushEnabled: true });
      return "ok";
    } catch {
      return "failed";
    }
  },

  dismissPushPrompt: () => set({ pushPromptDismissed: true }),

  markNotificationRead: (id) => {
    const user = get().user;
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    if (user) void api.markNotificationRead(user.id, id).catch(() => {});
  },

  markAllNotificationsRead: () => {
    const user = get().user;
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
    // Single bulk API call instead of N individual requests
    if (user) void api.markAllNotificationsRead(user.id).catch(() => {});
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
    setTimeout(() => {
      void get().loadThreads();
      void get().loadNotifications();
    }, 0);
  }

  // The api layer clears the token and fires this when the backend rejects the
  // saved session (expired, resigned with a new secret, or the user no longer
  // exists server-side). Log out so the stale cached profile stops driving
  // endless failing requests, then force a real reload rather than just
  // re-rendering in place — a browser that's been open across a deploy may
  // also be holding a stale cached bundle, and a plain client-side state
  // clear wouldn't replace that. Guarded so a persistently broken backend
  // can't reload-loop the tab.
  window.addEventListener("ninermarket:session-invalid", () => {
    get().logout();
    const key = "nmk-session-reload";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.location.reload();
  });

  return state;
});
