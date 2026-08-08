import { create } from "zustand";
import { CONVS } from "@/data/conversations";
import type { Conversation } from "@/data/conversations";
import { api } from "@/lib/api";
import { avatarUrl } from "@/lib/avatar";
import { fromDto } from "@/lib/listings";
import { clearUser, loadUser, saveUser } from "@/lib/user";
import type { CurrentUser, Listing, NotificationDto } from "@/lib/types";

const SAVED_KEY = "ninermarket-saved";

function loadSaved(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
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
  activeConvId: number;
  inputText: string;
  notifications: NotificationDto[];

  signIn: (user: CurrentUser) => void;
  logout: () => void;
  updateProfile: (year: string, payments: string[]) => void;
  loadListings: () => Promise<void>;
  addListing: (listing: Listing) => void;
  toggleSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  setActiveConvId: (id: number) => void;
  setInputText: (text: string) => void;
  sendMessage: () => void;
  openConversationForListing: (listingId: string) => void;
  loadThreads: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  messagesOpen: boolean;
  openMessagesOverlay: () => void;
  openMessageOverlay: (listingId: string) => void;
  closeMessagesOverlay: () => void;
  listingOverlayId: string | null;
  openListingOverlay: (listingId: string) => void;
  closeListingOverlay: () => void;
  markListingSold: (listingId: string) => Promise<void>;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  user: loadUser(),
  listings: [],
  loading: true,
  listingsError: null,
  savedItems: loadSaved(),
  convs: CONVS,
  activeConvId: 1,
  inputText: "",
  notifications: [],
  messagesOpen: false,
  listingOverlayId: null,

  signIn: (user) => {
    set({ user });
    void get().loadNotifications();
    void get().loadThreads();
  },
  logout: () => {
    clearUser();
    set({ user: null });
  },

  updateProfile: (year, payments) => {
    const user = get().user;
    if (!user) return;
    const updated: CurrentUser = { ...user, school_year: year, payment_methods: payments };
    saveUser(updated);
    set({ user: updated });
  },

  loadListings: async () => {
    if (!get().user) return;
    set({ loading: true });
    try {
      const dtos = await api.listListings();
      set({ listings: dtos.map(fromDto), loading: false, listingsError: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load listings";
      set({ loading: false, listingsError: message });
    }
  },

  addListing: (listing) => set((state) => ({ listings: [listing, ...state.listings] })),

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
    set((state) => ({
      activeConvId: id,
      convs: state.convs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    }));
    if (user) void api.markThreadRead(user.id, id).catch(() => {});
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
      if (user) void api.markThreadRead(user.id, existing.id).catch(() => {});
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

  loadThreads: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const list = await api.getThreads(user.id);
      if (list.length > 0) set({ convs: list });
    } catch {
      // Keep the seeded local conversations when the backend is unavailable.
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

  openMessageOverlay: (listingId) => {
    get().openConversationForListing(listingId);
    set({ messagesOpen: true });
  },

  openMessagesOverlay: () => set({ messagesOpen: true }),

  closeMessagesOverlay: () => set({ messagesOpen: false }),

  openListingOverlay: (listingId) => set({ listingOverlayId: listingId }),

  closeListingOverlay: () => set({ listingOverlayId: null }),

  markListingSold: async (listingId) => {
    await api.markListingSold(listingId);
    set((state) => ({
      listings: state.listings.map((l) => (l.id === listingId ? { ...l, status: "sold" } : l)),
    }));
  },
}));
