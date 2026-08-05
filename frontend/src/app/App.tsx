import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent, FormEvent } from "react";
import {
  Search, ShoppingBag, BookOpen, Sofa, Laptop, Bike, Shirt,
  ChevronRight, Heart, MapPin, Bell, MessageCircle, Plus,
  Star, Filter, Grid, List, GraduationCap, Home, Package,
  X, Send, Paperclip, Smile,
} from "lucide-react";
import { api } from "../lib/api";
import { fromDto, CURRENT_USER_ID } from "../lib/types";
import type { Listing } from "../lib/types";
import s from "./App.module.css";
import m from "./Messaging.module.css";

// ─── Data ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "all",       label: "All Categories",     icon: Grid },
  { id: "movein",    label: "Move-In Essentials",  icon: Home },
  { id: "textbooks", label: "Textbooks",           icon: BookOpen },
  { id: "furniture", label: "Dorm Furniture",      icon: Sofa },
  { id: "electronics", label: "Electronics",       icon: Laptop },
  { id: "bikes",     label: "Bikes & Transport",   icon: Bike },
  { id: "clothing",  label: "Clothing & Greek",    icon: Shirt },
  { id: "supplies",  label: "School Supplies",     icon: Package },
  { id: "services",  label: "Student Services",    icon: Star },
];

const CONDITIONS = ["Like New", "Excellent", "Good", "Fair", "Service"];

// Demo data shown only when the backend is unreachable
const DEMO_LISTINGS: Listing[] = [
  { id: "1",  title: "Organic Chemistry (Clayden) 2nd Ed.",  price: 45,   category: "textbooks",   campus: "North Campus",     time: "2h ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=400&fit=crop&auto=format",  seller: "Maya T.",   sellerRating: 4.9 },
  { id: "2",  title: "IKEA KALLAX Shelf Unit (White)",        price: 35,   category: "furniture",   campus: "West Dorms",       time: "5h ago",  condition: "Like New", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop&auto=format",  seller: "Jordan K.", sellerRating: 5.0 },
  { id: "3",  title: "Twin XL Mattress Topper",               price: 28,   category: "movein",      campus: "East Side",        time: "1d ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=400&fit=crop&auto=format",  seller: "Priya S.",  sellerRating: 4.7 },
  { id: "4",  title: "MacBook Pro 14\" M2 (2023)",            price: 1100, category: "electronics", campus: "Main Quad",        time: "3h ago",  condition: "Excellent",image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop&auto=format",  seller: "Chris L.",  sellerRating: 4.8 },
  { id: "5",  title: "Trek 7.2 FX City Bike",                 price: 280,  category: "bikes",       campus: "South Gate",       time: "6h ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400&h=400&fit=crop&auto=format",  seller: "Sam R.",    sellerRating: 4.6 },
  { id: "6",  title: "Calculus: Early Transcendentals 8e",    price: 30,   category: "textbooks",   campus: "Engineering Hall", time: "12h ago", condition: "Fair",     image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=400&fit=crop&auto=format",  seller: "Alex P.",   sellerRating: 4.5 },
  { id: "7",  title: "Mini Fridge (Galanz 3.1 cu ft)",        price: 65,   category: "movein",      campus: "Res Life Complex", time: "2d ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400&h=400&fit=crop&auto=format",  seller: "Olivia M.", sellerRating: 4.9 },
  { id: "8",  title: "Desk Lamp + USB Charging Hub",          price: 18,   category: "movein",      campus: "North Campus",     time: "4h ago",  condition: "Like New", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop&auto=format",  seller: "Nadia W.",  sellerRating: 4.8 },
  { id: "9",  title: "Sigma Chi Formal Suit (38R)",            price: 55,   category: "clothing",    campus: "Greek Row",        time: "1d ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=400&fit=crop&auto=format",  seller: "Tyler B.",  sellerRating: 4.4 },
  { id: "10", title: "Peer Tutoring — Orgo & Bio Chem",       price: 20,   category: "services",    campus: "Science Center",   time: "3d ago",  condition: "Service",  image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=400&fit=crop&auto=format",  seller: "Emma Z.",   sellerRating: 5.0 },
  { id: "11", title: "Psychology 101 Course Pack Bundle",      price: 22,   category: "textbooks",   campus: "Social Sciences",  time: "7h ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=400&fit=crop&auto=format",  seller: "Lena H.",   sellerRating: 4.7 },
  { id: "12", title: "Standing Desk Converter",               price: 48,   category: "furniture",   campus: "Off-Campus Ave",   time: "5d ago",  condition: "Like New", image: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&h=400&fit=crop&auto=format",  seller: "Felix G.",  sellerRating: 4.6 },
];

const CONDITION_CLASS: Record<string, string> = {
  "Like New":  s.condLikeNew,
  "Excellent": s.condExcellent,
  "Good":      s.condGood,
  "Fair":      s.condFair,
  "Service":   s.condService,
};

// ─── Conversation seed data (local; messaging backend not built yet) ────────

interface Message {
  id: number;
  text: string;
  sent: boolean;
  time: string;
}

interface Conversation {
  id: number;
  listingId: string;
  name: string;
  avatar: string;
  online: boolean;
  unread: number;
  lastMsg: string;
  lastTime: string;
  messages: Message[];
}

const CONVS: Conversation[] = [
  {
    id: 1, listingId: "4", name: "Chris L.", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format",
    online: true, unread: 2, lastMsg: "Is it still available?", lastTime: "3h",
    messages: [
      { id: 1, text: "Hey! Is the MacBook still available?", sent: false, time: "10:12 AM" },
      { id: 2, text: "Yes it is! Just listed it yesterday.", sent: true, time: "10:14 AM" },
      { id: 3, text: "What's the lowest you'd go?", sent: false, time: "10:15 AM" },
      { id: 4, text: "I could do $1,050 if you pick up today.", sent: true, time: "10:17 AM" },
      { id: 5, text: "Is it still available?", sent: false, time: "1:30 PM" },
    ],
  },
  {
    id: 2, listingId: "1", name: "Maya T.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format",
    online: false, unread: 0, lastMsg: "Can you hold it til Friday?", lastTime: "1d",
    messages: [
      { id: 1, text: "Hi! Is the Organic Chem book in good shape?", sent: false, time: "Yesterday 2:00 PM" },
      { id: 2, text: "Yep, no highlighting, all pages intact.", sent: true, time: "Yesterday 2:05 PM" },
      { id: 3, text: "Can you hold it til Friday?", sent: false, time: "Yesterday 2:10 PM" },
    ],
  },
  {
    id: 3, listingId: "5", name: "Sam R.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format",
    online: true, unread: 0, lastMsg: "Meet at the bike rack?", lastTime: "6h",
    messages: [
      { id: 1, text: "Does the bike come with a lock?", sent: false, time: "9:00 AM" },
      { id: 2, text: "No lock, but I can throw in the pump.", sent: true, time: "9:02 AM" },
      { id: 3, text: "Deal! Meet at the bike rack?", sent: false, time: "9:05 AM" },
    ],
  },
  {
    id: 4, listingId: "7", name: "Olivia M.", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&h=80&fit=crop&auto=format",
    online: false, unread: 1, lastMsg: "Does the fridge smell?", lastTime: "2d",
    messages: [
      { id: 1, text: "Does the fridge smell?", sent: false, time: "2 days ago" },
    ],
  },
];

const QUICK_REPLIES = ["Is it still available?", "Can you do lower?", "Where can we meet?", "I'll take it!"];

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [listings, setListings]         = useState<Listing[]>([]);
  const [loading, setLoading]           = useState(true);
  const [usingDemo, setUsingDemo]       = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery]       = useState("");
  const [savedItems, setSavedItems]         = useState<Set<string>>(new Set(["2", "5", "12"]));
  const [viewMode, setViewMode]             = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy]                 = useState("recent");
  const [msgOpen, setMsgOpen]               = useState(false);
  const [activeConvId, setActiveConvId]     = useState<number>(1);
  const [convs, setConvs]                   = useState<Conversation[]>(CONVS);
  const [inputText, setInputText]           = useState("");
  const [sellOpen, setSellOpen]             = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listListings()
      .then(dtos => {
        if (cancelled) return;
        setListings(dtos.map(fromDto));
        setUsingDemo(false);
      })
      .catch(() => {
        if (cancelled) return;
        setListings(DEMO_LISTINGS);
        setUsingDemo(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toggleSave = (id: string) => {
    setSavedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openMsgForListing = (listingId: string) => {
    const existing = convs.find(c => c.listingId === listingId);
    if (existing) {
      setActiveConvId(existing.id);
    } else {
      const listing = listings.find(l => l.id === listingId);
      if (!listing) return;
      const newConv: Conversation = {
        id: convs.length + 10,
        listingId,
        name: listing.seller,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(listing.seller)}&size=80&background=1a7a3c&color=fff`,
        online: Math.random() > 0.5,
        unread: 0,
        lastMsg: "",
        lastTime: "now",
        messages: [],
      };
      setConvs(prev => [newConv, ...prev]);
      setActiveConvId(newConv.id);
    }
    setMsgOpen(true);
  };

  const sendMessage = () => {
    const text = inputText.trim();
    if (!text) return;
    const newMsg: Message = { id: Date.now(), text, sent: true, time: "Just now" };
    setConvs(prev => prev.map(c =>
      c.id === activeConvId
        ? { ...c, messages: [...c.messages, newMsg], lastMsg: text, lastTime: "now", unread: 0 }
        : c
    ));
    setInputText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convs, activeConvId]);

  const filtered = listings.filter(l => {
    const matchCat = activeCategory === "all" || l.category === activeCategory;
    const matchSearch = !searchQuery ||
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.campus.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  }).sort((a, b) => {
    if (sortBy === "price-asc")  return a.price - b.price;
    if (sortBy === "price-desc") return b.price - a.price;
    return 0;
  });

  const activeConv   = convs.find(c => c.id === activeConvId) ?? convs[0];
  const activeListing = listings.find(l => l.id === activeConv.listingId);
  const totalUnread  = convs.reduce((n, c) => n + c.unread, 0);

  return (
    <div className={s.page}>
      {/* ── Navbar ── */}
      <nav className={s.navbar}>
        <div className={s.navInner}>
          <div className={s.logo}>
            <div className={s.logoIcon}><GraduationCap size={18} /></div>
            <span className={s.logoText}>CampusMarket</span>
          </div>

          <div className={s.searchWrap}>
            <span className={s.searchIcon}><Search size={15} /></span>
            <input
              className={s.searchInput}
              type="text"
              placeholder="Search listings, textbooks, dorm items..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={s.navActions}>
            <button className={s.iconBtn}>
              <Bell size={16} />
              <span className={s.notifDot} />
            </button>
            <button
              className={`${s.iconBtn} ${msgOpen ? s.iconBtnActive : ""}`}
              onClick={() => setMsgOpen(v => !v)}
              style={{ position: "relative" }}
            >
              <MessageCircle size={16} />
              {totalUnread > 0 && (
                <span className={s.notifDot} style={{ background: "#f87171" }}>
                </span>
              )}
            </button>
            <button className={s.sellBtn} onClick={() => setSellOpen(true)}>
              <Plus size={14} />
              <span className={s.sellBtnLabel}>Sell</span>
            </button>
            <img
              className={s.navAvatar}
              src="https://images.unsplash.com/photo-1529665253569-6d01c0eaf7b6?w=64&h=64&fit=crop&auto=format"
              alt="Your profile"
            />
          </div>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className={s.body}>
        {/* Sidebar */}
        <aside className={s.sidebar}>
          <div className={s.sidebarInner}>
            <span className={s.sectionLabel}>Browse by Category</span>
            <nav className={s.catNav}>
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    className={`${s.catBtn} ${active ? s.catBtnActive : ""}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <Icon size={15} className={active ? s.catIconActive : s.catIcon} />
                    {cat.label}
                    {active && <ChevronRight size={13} className={s.catChevron} />}
                  </button>
                );
              })}
            </nav>

            <hr className={s.activityDivider} />
            <span className={s.sectionLabel}>Your Activity</span>
            <nav className={s.catNav}>
              <button className={s.catBtn}>
                <Heart size={15} className={s.catIcon} />
                Saved Items
                <span className={s.countBadge}>{savedItems.size}</span>
              </button>
              <button className={s.catBtn}>
                <ShoppingBag size={15} className={s.catIcon} />
                Your Listings
              </button>
            </nav>

            <div className={s.promoBox}>
              <p className={s.promoTitle}>Move-In Season!</p>
              <p className={s.promoText}>Hundreds of dorm essentials listed this week. Check daily for new drops.</p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className={s.main}>
          {/* Section header */}
          <div className={s.mainHeader}>
            <div>
              <h1 className={s.mainTitle}>
                {CATEGORIES.find(c => c.id === activeCategory)?.label ?? "All Listings"}
              </h1>
              <p className={s.mainCount}>{filtered.length} listings near your campus</p>
            </div>
            <div className={s.controls}>
              <select
                className={s.sortSelect}
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="recent">Most Recent</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
              </select>
              <button className={s.filterBtn}>
                <Filter size={13} /> Filter
              </button>
              <div className={s.viewToggle}>
                <button
                  className={`${s.viewBtn} ${viewMode === "grid" ? s.viewBtnActive : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid size={15} />
                </button>
                <button
                  className={`${s.viewBtn} ${viewMode === "list" ? s.viewBtnActive : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {usingDemo && (
            <div className={s.demoBanner}>
              Backend unreachable — showing demo data. Start the API on port 8000 to connect.
            </div>
          )}

          {/* Mobile pills */}
          <div className={s.mobilePills}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`${s.pill} ${activeCategory === cat.id ? s.pillActive : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Listings */}
          {loading ? (
            <div className={s.emptyState}>
              <Search size={44} className={s.emptyIcon} />
              <p className={s.emptyTitle}>Loading listings...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className={s.emptyState}>
              <Search size={44} className={s.emptyIcon} />
              <p className={s.emptyTitle}>No listings found</p>
              <p className={s.emptyBody}>Try a different search or category</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className={s.grid}>
              {filtered.map(item => (
                <ListingCard
                  key={item.id}
                  item={item}
                  saved={savedItems.has(item.id)}
                  onToggleSave={() => toggleSave(item.id)}
                  onMessage={() => openMsgForListing(item.id)}
                />
              ))}
            </div>
          ) : (
            <div className={s.listView}>
              {filtered.map(item => (
                <ListingRow
                  key={item.id}
                  item={item}
                  saved={savedItems.has(item.id)}
                  onToggleSave={() => toggleSave(item.id)}
                  onMessage={() => openMsgForListing(item.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Messaging panel ── */}
      {msgOpen && (
        <>
          <div className={m.overlay} onClick={() => setMsgOpen(false)} />
          <div className={m.panel}>
            {/* Panel header */}
            <div className={m.panelHeader}>
              <MessageCircle size={18} color="#fff" />
              <span className={m.panelTitle}>Messages</span>
              <button className={m.closeBtn} onClick={() => setMsgOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className={m.panelBody}>
              {/* Conversation list */}
              <div className={m.convList}>
                <div className={m.convListHeader}>
                  <div className={m.convSearchWrap}>
                    <span className={m.convSearchIcon}><Search size={13} /></span>
                    <input className={m.convSearch} placeholder="Search messages..." />
                  </div>
                </div>
                <div className={m.convScroll}>
                  {convs.map(conv => (
                    <div
                      key={conv.id}
                      className={`${m.convItem} ${conv.id === activeConvId ? m.convItemActive : ""}`}
                      onClick={() => setActiveConvId(conv.id)}
                    >
                      <div className={m.convAvatarWrap}>
                        <img src={conv.avatar} alt={conv.name} className={m.convAvatar}
                          onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.name)}&size=80&background=1a7a3c&color=fff`; }} />
                        {conv.online && <span className={m.onlineDot} />}
                      </div>
                      <div className={m.convMeta}>
                        <div className={m.convTopRow}>
                          <span className={m.convName}>{conv.name}</span>
                          <span className={m.convTime}>{conv.lastTime}</span>
                        </div>
                        <p className={m.convPreview}>{conv.lastMsg || "New conversation"}</p>
                      </div>
                      {conv.unread > 0 && (
                        <span className={m.convUnread}>{conv.unread}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat view */}
              <div className={m.chatView}>
                {/* Listing header */}
                {activeListing && (
                  <div className={m.chatHeader}>
                    <img src={activeListing.image} alt={activeListing.title} className={m.chatThumb} />
                    <div className={m.chatHeaderInfo}>
                      <p className={m.chatListingTitle}>{activeListing.title}</p>
                      <p className={m.chatListingPrice}>${activeListing.price.toLocaleString()}</p>
                    </div>
                    <div className={m.chatHeaderActions}>
                      <button className={`${m.chatActionBtn} ${m.chatSaveBtn}`}>Save</button>
                      <button className={`${m.chatActionBtn} ${m.chatBuyBtn}`}>Buy Now</button>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className={m.messages}>
                  <div className={m.dateDivider}>
                    <div className={m.dateLine} />
                    <span className={m.dateLabel}>Today</span>
                    <div className={m.dateLine} />
                  </div>

                  {activeConv.messages.map(msg => (
                    <div key={msg.id} className={`${m.msgRow} ${msg.sent ? m.msgRowSent : ""}`}>
                      {!msg.sent && (
                        <img
                          src={activeConv.avatar}
                          alt={activeConv.name}
                          className={m.msgRowAvatar}
                          onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv.name)}&size=56&background=1a7a3c&color=fff`; }}
                        />
                      )}
                      <div className={m.msgGroup}>
                        <div className={`${m.bubble} ${msg.sent ? m.bubbleSent : m.bubbleRecv}`}>
                          {msg.text}
                        </div>
                        <span className={m.msgTime}>{msg.time}</span>
                      </div>
                    </div>
                  ))}

                  {activeConv.messages.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-fg-muted)", fontSize: "0.875rem" }}>
                      Start the conversation!
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick replies */}
                <div className={m.quickReplies}>
                  {QUICK_REPLIES.map(r => (
                    <button key={r} className={m.quickReply} onClick={() => setInputText(r)}>
                      {r}
                    </button>
                  ))}
                </div>

                {/* Input area */}
                <div className={m.inputArea}>
                  <button className={m.attachBtn}><Paperclip size={15} /></button>
                  <div className={m.inputWrap}>
                    <textarea
                      className={m.msgInput}
                      rows={1}
                      placeholder={`Message ${activeConv.name}...`}
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <button className={m.emojiBtn}><Smile size={16} /></button>
                  </div>
                  <button
                    className={`${m.sendBtn} ${!inputText.trim() ? m.sendBtnDisabled : ""}`}
                    onClick={sendMessage}
                    disabled={!inputText.trim()}
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Sell listing modal ── */}
      {sellOpen && (
        <SellModal
          onClose={() => setSellOpen(false)}
          onCreated={listing => {
            setListings(prev => [listing, ...prev]);
            setSellOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Sell modal ──────────────────────────────────────────────────────────────

function SellModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (listing: Listing) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIES[1].id);
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const dto = await api.createListing({
        seller_id: CURRENT_USER_ID,
        name,
        price: Number(price),
        category,
        condition,
        description,
        pickup_location: location,
      });
      onCreated(fromDto(dto));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create listing");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className={s.modalOverlay} onClick={onClose} />
      <div className={s.modal} role="dialog" aria-modal="true" aria-label="Sell an item">
        <div className={s.modalHeader}>
          <h2 className={s.modalTitle}>Sell an item</h2>
          <button className={s.modalClose} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className={s.modalForm}>
          <label className={s.formField}>
            <span className={s.formLabel}>Title</span>
            <input
              className={s.formInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="What are you selling?"
              required
            />
          </label>

          <div className={s.formRow}>
            <label className={s.formField}>
              <span className={s.formLabel}>Price ($)</span>
              <input
                className={s.formInput}
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </label>
            <label className={s.formField}>
              <span className={s.formLabel}>Condition</span>
              <select
                className={s.formSelect}
                value={condition}
                onChange={e => setCondition(e.target.value)}
              >
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <label className={s.formField}>
            <span className={s.formLabel}>Category</span>
            <select
              className={s.formSelect}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {CATEGORIES.filter(c => c.id !== "all").map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>

          <label className={s.formField}>
            <span className={s.formLabel}>Pickup location</span>
            <input
              className={s.formInput}
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Student Union"
              required
            />
          </label>

          <label className={s.formField}>
            <span className={s.formLabel}>Description</span>
            <textarea
              className={s.formTextarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Condition details, specs, why you're selling..."
              rows={3}
            />
          </label>

          {error && <p className={s.formError}>{error}</p>}

          <div className={s.modalActions}>
            <button type="button" className={s.btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={s.btnPrimary} disabled={submitting}>
              {submitting ? "Posting..." : "Post Listing"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── ListingCard ─────────────────────────────────────────────────────────────

function ListingCard({ item, saved, onToggleSave, onMessage }: {
  item: Listing; saved: boolean; onToggleSave: () => void; onMessage: () => void;
}) {
  return (
    <div className={s.card} onClick={onMessage}>
      <div className={s.cardImageWrap}>
        <img src={item.image} alt={item.title} className={s.cardImage} />
        <button
          className={`${s.saveBtn} ${saved ? s.saveBtnActive : ""}`}
          onClick={e => { e.stopPropagation(); onToggleSave(); }}
        >
          <Heart size={14} fill={saved ? "currentColor" : "none"} />
        </button>
        <span className={`${s.condBadge} ${CONDITION_CLASS[item.condition]}`}>
          {item.condition}
        </span>
      </div>
      <div className={s.cardBody}>
        <p className={s.cardPrice}>${item.price.toLocaleString()}</p>
        <p className={s.cardTitle}>{item.title}</p>
        <div className={s.cardMeta}>
          <MapPin size={11} className={s.cardMetaIcon} />
          <span>{item.campus}</span>
          <span className={s.cardMetaTime}>{item.time}</span>
        </div>
        <div className={s.sellerRow}>
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.seller)}&size=40&background=1a7a3c&color=fff`}
            alt={item.seller}
            className={s.sellerAvatar}
          />
          <span className={s.sellerName}>{item.seller}</span>
          <span className={s.sellerRating}>★ {item.sellerRating}</span>
        </div>
      </div>
    </div>
  );
}

// ─── ListingRow ──────────────────────────────────────────────────────────────

function ListingRow({ item, saved, onToggleSave, onMessage }: {
  item: Listing; saved: boolean; onToggleSave: () => void; onMessage: () => void;
}) {
  return (
    <div className={s.row}>
      <div className={s.rowImageWrap}>
        <img src={item.image} alt={item.title} className={s.rowImage} />
      </div>
      <div className={s.rowBody}>
        <div className={s.rowTop}>
          <div className={s.rowInfo}>
            <p className={s.rowPrice}>${item.price.toLocaleString()}</p>
            <p className={s.rowTitle}>{item.title}</p>
            <div className={s.rowTags}>
              <span className={`${s.condBadge} ${CONDITION_CLASS[item.condition]}`} style={{ position: "static" }}>
                {item.condition}
              </span>
              <span className={s.rowLocation}>
                <MapPin size={11} /> {item.campus}
              </span>
              <span className={s.rowTime}>{item.time}</span>
            </div>
          </div>
          <button
            className={`${s.rowSaveBtn} ${saved ? s.rowSaveBtnActive : ""}`}
            onClick={e => { e.stopPropagation(); onToggleSave(); }}
          >
            <Heart size={14} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
        <div className={s.rowBottom}>
          <span className={s.rowSeller}>{item.seller}</span>
          <span className={s.rowRating}>★ {item.sellerRating}</span>
          <button className={s.msgBtn} onClick={onMessage}>Message</button>
        </div>
      </div>
    </div>
  );
}
