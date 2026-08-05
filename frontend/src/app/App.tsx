import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent, FormEvent, ChangeEvent } from "react";
import {
  Search, ShoppingBag, BookOpen, Sofa, Laptop, Bike, Shirt,
  ChevronRight, Heart, MapPin, Bell, MessageCircle, Plus,
  Star, Filter, Grid, List, Home, Package,
  X, Send, Paperclip, Smile, LogOut, ImagePlus, ShieldCheck,
} from "lucide-react";
import { api } from "../lib/api";
import ninerLogo from "../assests/NinerMarket.png";
import { fromDto, currentUserId, loadUser, saveUser, clearUser } from "../lib/types";
import type { Listing, CurrentUser } from "../lib/types";
import { SCHOOL_YEARS, PAYMENT_METHODS } from "../lib/types";
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
  { id: "1",  title: "Organic Chemistry (Clayden) 2nd Ed.",  price: 45,   category: "textbooks",   campus: "North Campus",     time: "2h ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=400&fit=crop&auto=format",  seller: "Maya T.",   sellerRating: 4.9, description: "Well-kept textbook, no highlighting, all pages intact. Used for CHEM 2131/2132." },
  { id: "2",  title: "IKEA KALLAX Shelf Unit (White)",        price: 35,   category: "furniture",   campus: "West Dorms",       time: "5h ago",  condition: "Like New", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop&auto=format",  seller: "Jordan K.", sellerRating: 5.0, description: "Disassembles for easy move-out. Some assembly required, all tools included." },
  { id: "3",  title: "Twin XL Mattress Topper",               price: 28,   category: "movein",      campus: "East Side",        time: "1d ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=400&fit=crop&auto=format",  seller: "Priya S.",  sellerRating: 4.7, description: "Memory foam topper, deep-cleaned and stored fresh." },
  { id: "4",  title: "MacBook Pro 14\" M2 (2023)",            price: 1100, category: "electronics", campus: "Main Quad",        time: "3h ago",  condition: "Excellent",image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop&auto=format",  seller: "Chris L.",  sellerRating: 4.8, description: "Battery cycle count under 90, always cased, comes with charger. Selling for class upgrade." },
  { id: "5",  title: "Trek 7.2 FX City Bike",                 price: 280,  category: "bikes",       campus: "South Gate",       time: "6h ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400&h=400&fit=crop&auto=format",  seller: "Sam R.",    sellerRating: 4.6, description: "Great commuter bike for campus. Recently tuned, new brake pads." },
  { id: "6",  title: "Calculus: Early Transcendentals 8e",    price: 30,   category: "textbooks",   campus: "Engineering Hall", time: "12h ago", condition: "Fair",     image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=400&fit=crop&auto=format",  seller: "Alex P.",   sellerRating: 4.5, description: "Some pencil notes in the first few chapters, otherwise clean." },
  { id: "7",  title: "Mini Fridge (Galanz 3.1 cu ft)",        price: 65,   category: "movein",      campus: "Res Life Complex", time: "2d ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400&h=400&fit=crop&auto=format",  seller: "Olivia M.", sellerRating: 4.9, description: "Works perfectly, energy efficient, moved out and no longer needed." },
  { id: "8",  title: "Desk Lamp + USB Charging Hub",          price: 18,   category: "movein",      campus: "North Campus",     time: "4h ago",  condition: "Like New", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop&auto=format",  seller: "Nadia W.",  sellerRating: 4.8, description: "Adjustable LED lamp with 3 USB ports built in." },
  { id: "9",  title: "Sigma Chi Formal Suit (38R)",            price: 55,   category: "clothing",    campus: "Greek Row",        time: "1d ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=400&fit=crop&auto=format",  seller: "Tyler B.",  sellerRating: 4.4, description: "Worn once. Jacket, trousers, and tie included." },
  { id: "10", title: "Peer Tutoring — Orgo & Bio Chem",       price: 20,   category: "services",    campus: "Science Center",   time: "3d ago",  condition: "Service",  image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=400&fit=crop&auto=format",  seller: "Emma Z.",   sellerRating: 5.0, description: "Hourly tutoring sessions for organic and biochemistry, A-range student." },
  { id: "11", title: "Psychology 101 Course Pack Bundle",      price: 22,   category: "textbooks",   campus: "Social Sciences",  time: "7h ago",  condition: "Good",     image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=400&fit=crop&auto=format",  seller: "Lena H.",   sellerRating: 4.7, description: "Textbook plus study guide, all chapters intact." },
  { id: "12", title: "Standing Desk Converter",               price: 48,   category: "furniture",   campus: "Off-Campus Ave",   time: "5d ago",  condition: "Like New", image: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&h=400&fit=crop&auto=format",  seller: "Felix G.",  sellerRating: 4.6, description: "Clamps onto any desk, easy to move between dorm rooms." },
];

const CONDITION_CLASS: Record<string, string> = {
  "Like New":  s.condLikeNew,
  "Excellent": s.condExcellent,
  "Good":      s.condGood,
  "Fair":      s.condFair,
  "Service":   s.condService,
};

// ─── Auth helpers ───────────────────────────────────────────────────────────

function isCharlotteEmail(email: string): boolean {
  return /^[^\s@]+@charlotte\.edu$/.test(email.trim().toLowerCase());
}

function makeUserId(email: string): string {
  return (
    "u-" +
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

async function signInOrUp(
  mode: "signin" | "signup",
  name: string,
  email: string,
  schoolYear = "",
  payments: string[] = []
): Promise<CurrentUser> {
  const id = makeUserId(email);
  const normalized = email.trim().toLowerCase();
  const display_name =
    mode === "signup" ? name.trim() : normalized.split("@")[0];

  const profile: Partial<CurrentUser> = {};

  try {
    if (mode === "signup") {
      await api.createUser({
        id,
        email: normalized,
        display_name,
        school_year: schoolYear,
        payment_methods: payments,
      });
      profile.school_year = schoolYear;
      profile.payment_methods = payments;
    } else {
      const u = await api.getUser(id);
      profile.school_year = u.school_year;
      profile.payment_methods = u.payment_methods;
    }
  } catch {
    // Backend is optional — the app works fully in local demo mode.
  }

  const user: CurrentUser = { id, email: normalized, display_name, ...profile };
  saveUser(user);
  return user;
}

// ─── Terms & Conditions ─────────────────────────────────────────────────────

const TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: "Eligibility",
    body:
      "NinerMarket is exclusively for current UNC Charlotte students, faculty, and staff. You must sign in with a valid @charlotte.edu email, and your account is tied to your university identity.",
  },
  {
    title: "Verified community",
    body:
      "By using NinerMarket you confirm you are an active member of the UNC Charlotte community. Accounts that misrepresent their university affiliation will be suspended.",
  },
  {
    title: "Prohibited & restricted items",
    body:
      "You may not list any item that violates UNC Charlotte policy or the law, including weapons, drugs, alcohol (when prohibited), stolen goods, counterfeit items, or anything that endangers campus safety.",
  },
  {
    title: "Reporting to the university",
    body:
      "Any item against university policies will be reported and sent to the university. We reserve the right to report listings, messages, or users to UNC Charlotte officials (including the Dean of Students and University Police) when policy or law may have been violated.",
  },
  {
    title: "Transactions & payment disputes",
    body:
      "NinerMarket is a platform only and is not a party to any sale. Payment arrangements, refunds, delivery, and meetups are strictly between the buyer and the seller. Disputes about payment are not our fault and will not be handled by NinerMarket.",
  },
  {
    title: "Meetups & personal safety",
    body:
      "Always meet in well-lit, public areas on campus. NinerMarket does not arrange or supervise meetings, and you are responsible for your own safety.",
  },
  {
    title: "Items sold as-is",
    body:
      "Listings are described by their sellers. Inspect items in person before paying. NinerMarket does not guarantee the condition, authenticity, or availability of any item.",
  },
  {
    title: "Acceptable use",
    body:
      "Be honest and respectful. No spam, harassment, fraud, or misleading listings. Messages are for legitimate buying, selling, and requesting items only.",
  },
  {
    title: "Ratings",
    body:
      "Ratings reflect your community reputation. We may remove ratings that are fraudulent or retaliatory.",
  },
  {
    title: "Enforcement",
    body:
      "We may remove listings, restrict accounts, or revoke access at any time for violating these terms or university policy.",
  },
  {
    title: "Changes to these terms",
    body:
      "We may update these terms from time to time. Continued use of NinerMarket after changes means you accept the updated terms.",
  },
];

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
  const [user, setUser]             = useState<CurrentUser | null>(() => loadUser());
  const [listings, setListings]     = useState<Listing[]>([]);
  const [loading, setLoading]       = useState(true);
  const [usingDemo, setUsingDemo]   = useState(false);
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
  const [detailItem, setDetailItem]         = useState<Listing | null>(null);
  const [profileOpen, setProfileOpen]       = useState(false);
  const [setupUser, setSetupUser]           = useState<CurrentUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  const handleLogout = () => {
    clearUser();
    setUser(null);
    setProfileOpen(false);
  };

  const handleAuthed = (u: CurrentUser) => {
    setUser(u);
    if (!u.school_year) setSetupUser(u);
  };

  const handleSetupSave = async (year: string, payments: string[]) => {
    if (!setupUser) return;
    const updated: CurrentUser = {
      ...setupUser,
      school_year: year,
      payment_methods: payments,
    };
    saveUser(updated);
    setUser(updated);
    setSetupUser(null);
    try {
      await api.updateUser(updated.id, { school_year: year, payment_methods: payments });
    } catch {
      // Backend is optional — the profile is saved locally either way.
    }
  };

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

  const messageFromDetail = (listingId: string) => {
    setDetailItem(null);
    openMsgForListing(listingId);
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

  if (!user) {
    return <LoginPage onAuthed={handleAuthed} />;
  }

  return (
    <div className={s.page}>
      {/* ── Navbar ── */}
      <nav className={s.navbar}>
        <div className={s.navInner}>
          <div className={s.logo}>
            <img className={s.logoIcon} src={ninerLogo} alt="NinerMarket" />
            <span className={s.logoText}>NinerMarket</span>
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
            <div className={s.profileWrap}>
              <button className={s.navAvatar} onClick={() => setProfileOpen(v => !v)}>
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&size=64&background=1a7a3c&color=fff`}
                  alt="Your profile"
                />
              </button>
              {profileOpen && (
                <>
                  <div className={s.profileBackdrop} onClick={() => setProfileOpen(false)} />
                  <div className={s.profileMenu}>
                    <div className={s.profileMenuHeader}>
                      <p className={s.profileEmail}>{user.email}</p>
                      <p className={s.profileName}>{user.display_name}</p>
                    </div>
                    <button className={s.profileMenuItem} onClick={handleLogout}>
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
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
                  onOpen={() => setDetailItem(item)}
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
                  onOpen={() => setDetailItem(item)}
                  onMessage={() => openMsgForListing(item.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Listing detail overlay ── */}
      {detailItem && (
        <ListingDetail
          item={detailItem}
          saved={savedItems.has(detailItem.id)}
          onClose={() => setDetailItem(null)}
          onToggleSave={() => toggleSave(detailItem.id)}
          onMessage={() => messageFromDetail(detailItem.id)}
        />
      )}

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

      {/* ── First-run account setup ── */}
      {setupUser && (
        <AccountSetup
          name={setupUser.display_name}
          onSave={handleSetupSave}
          onSkip={() => setSetupUser(null)}
        />
      )}
    </div>
  );
}

// ─── Login page ─────────────────────────────────────────────────────────────

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8.1 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8.1 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 40.4 44 34.5 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

function LoginPage({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
  const [formOpen, setFormOpen]   = useState<"signin" | "signup" | null>(null);
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [agree, setAgree]         = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [helpOpen, setHelpOpen]   = useState(false);
  const [schoolYear, setSchoolYear] = useState("");
  const [payments, setPayments]   = useState<string[]>([]);
  const [error, setError]         = useState("");

  const validate = (requirePassword: boolean): string => {
    if (!isCharlotteEmail(email)) {
      return "Access is restricted to the UNC Charlotte community. Use a valid @charlotte.edu email.";
    }
    if (requirePassword && !password.trim()) {
      return "Please enter your password.";
    }
    if (!agree) {
      return "Please accept the Terms & Conditions to continue.";
    }
    return "";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const mode = formOpen === "signup" ? "signup" : "signin";
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (mode === "signup" && !schoolYear) {
      setError("Please select your school year.");
      return;
    }
    if (mode === "signup" && payments.length === 0) {
      setError("Select at least one payment method you accept.");
      return;
    }
    const err = validate(true);
    if (err) { setError(err); return; }
    setError("");
    try {
      const u = await signInOrUp(mode, name, email, schoolYear, payments);
      onAuthed(u);
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const googleContinue = async (googleEmail: string) => {
    setEmail(googleEmail);
    const err = validate(false);
    if (err) { setError(err); setGoogleOpen(false); return; }
    setGoogleOpen(false);
    setError("");
    try {
      const u = await signInOrUp("signin", name, googleEmail);
      onAuthed(u);
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const forgotPassword = () => {
    setError(
      "Password reset isn't available in this demo. Use the demo account or sign in with Google."
    );
  };

  const fillDemo = () => {
    setFormOpen("signin");
    setEmail("anna@charlotte.edu");
    setPassword("ninermarket-demo");
    setAgree(true);
    setError("");
  };

  const openForm = (mode: "signin" | "signup") => {
    setError("");
    setFormOpen(mode);
  };

  return (
    <div className={s.xPage}>
      <div className={s.xMain}>
        {/* Left — light side with headline, logo, features & footer */}
        <div className={s.xLeft}>
          <h1 className={s.xHeadline}>More accessible than ever</h1>
          <div className={s.xLogo}>
            <img className={s.xLogoImg} src={ninerLogo} alt="NinerMarket" />
          </div>
          <ul className={s.xFeatures}>
            <li><ShieldCheck size={16} /> Verified @charlotte.edu community</li>
            <li><ShoppingBag size={16} /> Textbooks, dorm essentials &amp; more</li>
            <li><MapPin size={16} /> Meet up on campus, pay your way</li>
          </ul>

          <footer className={s.xFooter}>
            <span>About</span>
            <span>·</span>
            <button type="button" className={s.xFooterLink} onClick={() => setHelpOpen(true)}>Help</button>
            <span>·</span>
            <button type="button" className={s.xFooterLink} onClick={() => setTermsOpen(true)}>Terms</button>
            <span>·</span>
            <span>Privacy</span>
            <span>·</span>
            <span>© 2026 NinerMarket</span>
          </footer>
        </div>

        {/* Right — light side with join panel */}
        <div className={s.xRight}>
          <div className={s.xCard}>
            <h2 className={s.xSubheadline}>Shop &amp; sell on campus</h2>

            <div className={s.xActions}>
              <button type="button" className={s.xSocialBtn} onClick={() => setGoogleOpen(true)}>
                <GoogleG />
                Continue with Google
              </button>
              <p className={s.xOnlyNote}>
                NinerMarket is for UNC Charlotte students, faculty &amp; staff only. Sign in with your
                @charlotte.edu Google account.
              </p>
              <button type="button" className={s.xEmailLink} onClick={() => openForm("signup")}>
                Sign up with your email instead
              </button>
              <label className={s.xTerms}>
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                <span>
                  By signing up, you agree to the{" "}
                  <button type="button" className={s.xTermsLink} onClick={() => setTermsOpen(true)}>
                    Terms &amp; Conditions
                  </button>
                  .
                </span>
              </label>
              {error && <p className={s.xError}>{error}</p>}
            </div>

            <div className={s.xSignInBox}>
              <p className={s.xSignInLabel}>Already have an account?</p>
              <button type="button" className={s.xSignInBtn} onClick={() => openForm("signin")}>
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sign-in / sign-up modal */}
      {formOpen && (
        <>
          <div className={s.xOverlay} onClick={() => setFormOpen(null)} />
          <div className={s.xModal} role="dialog" aria-modal="true" aria-label={formOpen === "signup" ? "Create your account" : "Sign in"}>
            <div className={s.xModalHeader}>
              <button className={s.xModalClose} onClick={() => setFormOpen(null)} aria-label="Close">
                <X size={18} />
              </button>
              <img className={s.xModalLogo} src={ninerLogo} alt="NinerMarket" />
              <h2 className={s.xModalTitle}>
                {formOpen === "signup" ? "Create your account" : "Sign in to NinerMarket"}
              </h2>
            </div>
            <form onSubmit={submit} className={s.xForm}>
              {formOpen === "signup" && (
                <input
                  className={s.xInput}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                />
              )}
              <input
                className={s.xInput}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address (@charlotte.edu)"
              />
              {email && email.includes("@") && !isCharlotteEmail(email) && (
                <span className={s.xFieldError}>Must be a @charlotte.edu email to access NinerMarket.</span>
              )}
              <input
                className={s.xInput}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
              />
              {formOpen === "signup" && (
                <>
                  <div className={s.xFormBlock}>
                    <span className={s.xFormLabel}>What year are you in?</span>
                    <select
                      className={s.xSelect}
                      value={schoolYear}
                      onChange={e => setSchoolYear(e.target.value)}
                    >
                      <option value="">Select your year</option>
                      {SCHOOL_YEARS.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.xFormBlock}>
                    <span className={s.xFormLabel}>Payment methods you accept</span>
                    <div className={s.xPayments}>
                      {PAYMENT_METHODS.map(p => (
                        <label key={p} className={s.xPay}>
                          <input
                            type="checkbox"
                            checked={payments.includes(p)}
                            onChange={() =>
                              setPayments(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
                            }
                          />
                          <span>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {formOpen === "signin" && (
                <button type="button" className={s.xForgot} onClick={forgotPassword}>
                  Forgot password?
                </button>
              )}
              <label className={s.xTerms}>
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                <span>
                  I agree to the{" "}
                  <button type="button" className={s.xTermsLink} onClick={() => setTermsOpen(true)}>
                    Terms &amp; Conditions
                  </button>
                  .
                </span>
              </label>
              {error && <p className={s.xError}>{error}</p>}
              <button type="submit" className={s.xSubmitBtn}>
                {formOpen === "signup" ? "Sign up" : "Log in"}
              </button>
              {formOpen === "signin" && (
                <button type="button" className={s.xDemoHint} onClick={fillDemo}>
                  Demo account: anna@charlotte.edu
                </button>
              )}
            </form>
          </div>
        </>
      )}

      {googleOpen && (
        <GoogleChooser
          agreed={agree}
          onAgree={setAgree}
          onClose={() => setGoogleOpen(false)}
          onContinue={googleContinue}
        />
      )}

      {termsOpen && (
        <TermsModal
          accepted={agree}
          onAccept={() => { setAgree(true); setTermsOpen(false); }}
          onClose={() => setTermsOpen(false)}
        />
      )}

      {helpOpen && (
        <HelpModal
          onClose={() => setHelpOpen(false)}
        />
      )}
    </div>
  );
}

// ─── First-run account setup ─────────────────────────────────────────────────

function AccountSetup({ name, onSave, onSkip }: {
  name: string;
  onSave: (year: string, payments: string[]) => void;
  onSkip: () => void;
}) {
  const [year, setYear]     = useState("");
  const [payments, setPayments] = useState<string[]>([]);
  const [error, setError]   = useState("");

  const togglePayment = (p: string) =>
    setPayments(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const submit = () => {
    if (!year) { setError("Please select your school year."); return; }
    if (payments.length === 0) { setError("Select at least one payment method you accept."); return; }
    onSave(year, payments);
  };

  return (
    <>
      <div className={s.setupOverlay} />
      <div className={s.setupModal} role="dialog" aria-modal="true" aria-label="Finish setting up your account">
        <div className={s.setupHeader}>
          <img className={s.setupLogo} src={ninerLogo} alt="NinerMarket" />
          <h2 className={s.setupTitle}>Finish your profile</h2>
        </div>
        <p className={s.setupSub}>
          Welcome to NinerMarket, {name}! Let buyers know your school year and how you like to be paid.
        </p>

        <label className={s.setupLabel}>What year are you in?</label>
        <div className={s.setupYears}>
          {SCHOOL_YEARS.map(y => (
            <button
              key={y}
              type="button"
              className={`${s.setupPill} ${year === y ? s.setupPillActive : ""}`}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>

        <label className={s.setupLabel}>Payment methods you accept</label>
        <div className={s.setupPayments}>
          {PAYMENT_METHODS.map(p => (
            <label key={p} className={s.setupPay}>
              <input type="checkbox" checked={payments.includes(p)} onChange={() => togglePayment(p)} />
              <span>{p}</span>
            </label>
          ))}
        </div>

        {error && <p className={s.setupError}>{error}</p>}

        <div className={s.setupActions}>
          <button type="button" className={s.setupSkip} onClick={onSkip}>Skip for now</button>
          <button type="button" className={s.setupSave} onClick={submit}>Save</button>
        </div>
      </div>
    </>
  );
}

// ─── Google account chooser (mock) ──────────────────────────────────────────

function GoogleChooser({ agreed, onAgree, onClose, onContinue }: {
  agreed: boolean;
  onAgree: (v: boolean) => void;
  onClose: () => void;
  onContinue: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isCharlotteEmail(email)) {
      setError("Choose the Google account associated with your @charlotte.edu email.");
      return;
    }
    if (!agreed) {
      setError("Please accept the Terms & Conditions to continue.");
      return;
    }
    onContinue(email);
  };

  return (
    <>
      <div className={s.googleOverlay} onClick={onClose} />
      <div className={s.googleModal} role="dialog" aria-modal="true" aria-label="Sign in with Google">
        <div className={s.googleLogo}><GoogleG /></div>
        <h2 className={s.googleTitle}>Sign in with Google</h2>
        <p className={s.googleSub}>Use your UNC Charlotte account</p>
        <form onSubmit={submit} className={s.googleForm}>
          <input
            className={s.loginInput}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@charlotte.edu"
            autoFocus
          />
          <label className={s.loginTerms} style={{ justifyContent: "flex-start", textAlign: "left" }}>
            <input type="checkbox" checked={agreed} onChange={e => onAgree(e.target.checked)} />
            <span>
              I agree to the{" "}
              <button type="button" className={s.loginTermsLink} onClick={() => setTermsOpen(true)}>
                Terms &amp; Conditions
              </button>
            </span>
          </label>
          {error && <p className={s.formError}>{error}</p>}
          <button type="submit" className={`${s.loginSubmit} ${s.btnPrimary}`}>Continue</button>
        </form>
        <button type="button" className={s.googleBack} onClick={onClose}>Cancel</button>
        <button
          type="button"
          className={s.xDemoHint}
          onClick={() => {
            onAgree(true);
            setEmail("anna@charlotte.edu");
          }}
        >
          Demo account: anna@charlotte.edu
        </button>
      </div>

      {termsOpen && (
        <TermsModal
          accepted={agreed}
          onAccept={() => { onAgree(true); setTermsOpen(false); }}
          onClose={() => setTermsOpen(false)}
        />
      )}
    </>
  );
}

// ─── Terms & Conditions modal ───────────────────────────────────────────────

function TermsModal({ accepted, onAccept, onClose }: {
  accepted: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className={s.googleOverlay} onClick={onClose} />
      <div className={`${s.googleModal} ${s.termsModal}`} role="dialog" aria-modal="true" aria-label="Terms and conditions">
        <div className={s.termsHeader}>
          <ShieldCheck size={20} className={s.termsIcon} />
          <h2 className={s.googleTitle}>NinerMarket Terms &amp; Conditions</h2>
        </div>
        <div className={s.termsScroll}>
          {TERMS_SECTIONS.map((t, i) => (
            <div key={i} className={s.termsSection}>
              <h3>{i + 1}. {t.title}</h3>
              <p>{t.body}</p>
            </div>
          ))}
        </div>
        <div className={s.termsActions}>
          <button type="button" className={s.btnGhost} onClick={onClose}>Decline</button>
          <button type="button" className={s.btnPrimary} onClick={onAccept}>
            {accepted ? "Done" : "I Accept"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Help & support modal ────────────────────────────────────────────────────

function HelpModal({ onClose }: {
  onClose: () => void;
}) {
  return (
    <>
      <div className={s.googleOverlay} onClick={onClose} />
      <div className={`${s.googleModal} ${s.helpModal}`} role="dialog" aria-modal="true" aria-label="Help and support">
        <div className={s.termsHeader}>
          <MessageCircle size={20} className={s.termsIcon} />
          <h2 className={s.googleTitle}>Help &amp; Support</h2>
        </div>
        <p className={s.helpIntro}>
          Need a hand with listings, payments, or your account? Email our support team and we&rsquo;ll get
          back to you as soon as we can.
        </p>
        <div className={s.helpContact}>
          <p className={s.helpContactLabel}>Support contacts</p>
          <a className={s.helpContactLink} href="mailto:gmallang@charlotte.edu">gmallang@charlotte.edu</a>
          <a className={s.helpContactLink} href="mailto:ksaifeld@charlotte.edu">ksaifeld@charlotte.edu</a>
        </div>
        <div className={s.termsActions}>
          <button type="button" className={s.btnPrimary} onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  );
}

// ─── Listing detail overlay ─────────────────────────────────────────────────

function ListingDetail({ item, saved, onClose, onToggleSave, onMessage }: {
  item: Listing;
  saved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
  onMessage: () => void;
}) {
  const photos = item.photos?.length ? item.photos : [item.image];
  const [activeImg, setActiveImg] = useState(0);
  const categoryLabel = CATEGORIES.find(c => c.id === item.category)?.label ?? item.category;

  return (
    <>
      <div className={s.detailOverlay} onClick={onClose} />
      <div className={s.detailModal} role="dialog" aria-modal="true" aria-label={item.title}>
        <button className={`${s.detailClose} ${s.modalClose}`} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className={s.detailBody}>
          <div className={s.detailGallery}>
            <img src={photos[activeImg]} alt={item.title} className={s.detailMainImg} />
            {photos.length > 1 && (
              <div className={s.detailThumbs}>
                {photos.map((p, i) => (
                  <img
                    key={i}
                    src={p}
                    alt={`${item.title} ${i + 1}`}
                    className={`${s.detailThumb} ${i === activeImg ? s.detailThumbActive : ""}`}
                    onClick={() => setActiveImg(i)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className={s.detailInfo}>
            <div className={s.detailTags}>
              <span className={`${s.detailCond} ${CONDITION_CLASS[item.condition]}`} style={{ position: "static" }}>
                {item.condition}
              </span>
              <span className={s.detailCategory}>{categoryLabel}</span>
            </div>
            <h2 className={s.detailTitle}>{item.title}</h2>
            <p className={s.detailPrice}>${item.price.toLocaleString()}</p>
            <div className={s.detailMeta}>
              <MapPin size={13} className={s.detailMetaIcon} />
              <span>{item.campus}</span>
              <span className={s.detailTime}>{item.time}</span>
            </div>
            <div className={s.detailSeller}>
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.seller)}&size=64&background=1a7a3c&color=fff`}
                alt={item.seller}
                className={s.detailSellerAvatar}
              />
              <div className={s.detailSellerInfo}>
                <p className={s.detailSellerName}>{item.seller}</p>
                <p className={s.detailSellerRating}>★ {item.sellerRating.toFixed(1)} rating</p>
                {item.sellerYear && <p className={s.detailSellerYear}>{item.sellerYear}</p>}
              </div>
            </div>
            {item.sellerPayments && item.sellerPayments.length > 0 && (
              <div className={s.detailPayments}>
                <span className={s.detailPaymentsLabel}>Accepted payment methods</span>
                <div className={s.detailPaymentsList}>
                  {item.sellerPayments.map(p => (
                    <span key={p} className={s.detailPayTag}>{p}</span>
                  ))}
                </div>
              </div>
            )}
            <div className={s.detailDesc}>
              <h3 className={s.detailDescTitle}>Description</h3>
              <p className={s.detailDescText}>
                {item.description || "No description provided by the seller."}
              </p>
            </div>
          </div>
        </div>
        <div className={s.detailFooter}>
          <button className={s.btnGhost} onClick={onToggleSave}>
            <Heart size={15} fill={saved ? "currentColor" : "none"} />
            {saved ? "Saved" : "Save"}
          </button>
          <button className={s.btnPrimary} onClick={onMessage}>
            <MessageCircle size={16} />
            Message Seller
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Sell modal ─────────────────────────────────────────────────────────────

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
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (photos.length >= 6) return;
      if (!file.type.startsWith("image/")) return;
      if (file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const dto = await api.createListing({
        seller_id: currentUserId(),
        name,
        price: Number(price),
        category,
        condition,
        description,
        pickup_location: location,
        photos,
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
          <div className={s.formField}>
            <span className={s.formLabel}>Photos</span>
            {photos.length > 0 && (
              <div className={s.photoGrid}>
                {photos.map((p, i) => (
                  <div key={i} className={s.photoPreview}>
                    <img src={p} alt={`Upload ${i + 1}`} />
                    <button type="button" className={s.photoRemove} onClick={() => removePhoto(i)} aria-label="Remove photo">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {photos.length < 6 && (
                  <button type="button" className={s.photoAddBtn} onClick={() => fileRef.current?.click()}>
                    <ImagePlus size={16} />
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              className={s.photoDrop}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={20} />
              <span>{photos.length ? "Add more photos" : "Click to add photos"}</span>
              <small>JPG or PNG, up to 6 photos</small>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className={s.photoDropInput}
              onChange={handleFileChange}
            />
          </div>

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

function ListingCard({ item, saved, onToggleSave, onOpen }: {
  item: Listing; saved: boolean; onToggleSave: () => void; onOpen: () => void;
}) {
  return (
    <div className={s.card} onClick={onOpen}>
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

function ListingRow({ item, saved, onToggleSave, onOpen, onMessage }: {
  item: Listing; saved: boolean; onToggleSave: () => void; onOpen: () => void; onMessage: () => void;
}) {
  return (
    <div className={s.row} onClick={onOpen}>
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
          <button
            className={s.msgBtn}
            onClick={e => { e.stopPropagation(); onMessage(); }}
          >
            Message
          </button>
        </div>
      </div>
    </div>
  );
}
