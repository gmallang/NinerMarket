import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  MessageCircle,
  Plus,
  LogOut,
  UserRound,
  ChevronRight,
  ChevronDown,
  Heart,
  ShoppingBag,
  Bell,
  Menu,
  X,
  Home,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import ninerLogo from "@/assets/NinerMarket.png";
import { avatarUrl } from "@/lib/avatar";
import { useMarketStore } from "@/lib/store";
import { CATEGORIES, CONDITIONS } from "@/data/categories";
import { LOCATION_GROUPS } from "@/data/locations";
import { Modal } from "@/components/shared/Modal";
import { SellForm } from "@/features/sell/SellForm";
import { MessagesOverlay } from "@/features/messaging/MessagesOverlay";
import { ListingOverlay } from "@/features/listings/ListingOverlay";
import { formatRelativeTime } from "@/lib/format";
import type { NotificationDto } from "@/lib/types";
import s from "./AppLayout.module.css";

// Consecutive identical notifications (e.g. a burst of offers on the same
// listing) collapse into a single row with a "(x2)"-style repeat count.
function groupNotifs(list: NotificationDto[]): NotificationDto[][] {
  const groups: NotificationDto[][] = [];
  for (const n of list) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1].text === n.text) {
      last.push(n);
    } else {
      groups.push([n]);
    }
  }
  return groups;
}

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();

  const user = useMarketStore((s) => s.user);
  const convs = useMarketStore((s) => s.convs);
  const savedCount = useMarketStore((s) => s.savedItems.size);
  const notifications = useMarketStore((s) => s.notifications);
  const loadNotifications = useMarketStore((s) => s.loadNotifications);
  const loadThreads = useMarketStore((s) => s.loadThreads);
  const startRealtimeInbox = useMarketStore((s) => s.startRealtimeInbox);
  const startRealtimeListings = useMarketStore((s) => s.startRealtimeListings);
  const markNotificationRead = useMarketStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useMarketStore((s) => s.markAllNotificationsRead);
  const clearNotifications = useMarketStore((s) => s.clearNotifications);
  const openListingOverlay = useMarketStore((s) => s.openListingOverlay);
  const logout = useMarketStore((s) => s.logout);
  const loadListings = useMarketStore((s) => s.loadListings);
  const refreshProfile = useMarketStore((s) => s.refreshProfile);
  const addListing = useMarketStore((s) => s.addListing);
  const updateListing = useMarketStore((s) => s.updateListing);
  const sellModal = useMarketStore((s) => s.sellModal);
  const openSellForm = useMarketStore((s) => s.openSellForm);
  const closeSellForm = useMarketStore((s) => s.closeSellForm);
  const messagesOpen = useMarketStore((s) => s.messagesOpen);
  const openMessagesOverlay = useMarketStore((s) => s.openMessagesOverlay);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [minPriceInput, setMinPriceInput] = useState(params.get("minPrice") ?? "");
  const [maxPriceInput, setMaxPriceInput] = useState(params.get("maxPrice") ?? "");
  const [showScrollFade, setShowScrollFade] = useState(false);
  const fadeSentinelRef = useRef<HTMLDivElement | null>(null);
  const totalUnread = convs.reduce((n, c) => n + c.unread, 0);
  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const activeConditions = (params.get("condition") ?? "").split(",").filter(Boolean);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (pathname !== "/") setQ("");
  }

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (user) {
      void loadNotifications();
      void loadThreads();
      startRealtimeInbox();
      startRealtimeListings();
    }
  }, [user, loadNotifications, loadThreads, startRealtimeInbox, startRealtimeListings]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const sentinel = fadeSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollFade(!entry.isIntersecting),
      { rootMargin: "0px 0px -24px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pathname !== "/") return;
    if (q === (params.get("q") ?? "")) return;
    const t = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      next.delete("saved");
      next.delete("mine");
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      navigate(`/?${next.toString()}`, { replace: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, params, pathname, navigate]);

  const submitSearch = () => {
    const next = new URLSearchParams(params);
    next.delete("saved");
    next.delete("mine");
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    navigate(`/?${next.toString()}`);
  };

  const applyFilter = (key: string, value: string) => {
    const next = new URLSearchParams(pathname === "/" ? params : undefined);
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(`/?${next.toString()}`);
  };

  const toggleCondition = (condition: string) => {
    const next = new Set(activeConditions);
    if (next.has(condition)) next.delete(condition);
    else next.add(condition);
    applyFilter("condition", Array.from(next).join(","));
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const filterFields = (
    <>
      <div className={s.filterGroup}>
        <label className={s.filterLabel}>Sort by</label>
        <select
          className={s.filterSelect}
          value={params.get("sort") ?? "recent"}
          onChange={(e) => applyFilter("sort", e.target.value)}
        >
          <option value="recent">Most Recent</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </div>

      <div className={s.filterGroup}>
        <label className={s.filterLabel}>Location</label>
        <select
          className={s.filterSelect}
          value={params.get("location") ?? ""}
          onChange={(e) => applyFilter("location", e.target.value)}
        >
          <option value="">All Locations</option>
          {LOCATION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className={s.filterGroup}>
        <label className={s.filterLabel}>Price Range</label>
        <div className={s.priceRow}>
          <input
            className={s.filterInputSmall}
            type="number"
            min={0}
            placeholder="Min"
            value={minPriceInput}
            onChange={(e) => setMinPriceInput(e.target.value)}
            onBlur={() => applyFilter("minPrice", minPriceInput.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilter("minPrice", minPriceInput.trim());
            }}
          />
          <span className={s.priceSep}>–</span>
          <input
            className={s.filterInputSmall}
            type="number"
            min={0}
            placeholder="Max"
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(e.target.value)}
            onBlur={() => applyFilter("maxPrice", maxPriceInput.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilter("maxPrice", maxPriceInput.trim());
            }}
          />
        </div>
      </div>

      <div className={s.filterGroup}>
        <label className={s.filterLabel}>Condition</label>
        <div className={s.checkboxList}>
          {CONDITIONS.map((condition) => (
            <label key={condition} className={s.checkboxRow}>
              <input
                type="checkbox"
                checked={activeConditions.includes(condition)}
                onChange={() => toggleCondition(condition)}
              />
              {condition}
            </label>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className={s.page}>
      <nav className={s.navbar}>
        <div className={s.navInner}>
          <div className={s.navLeft}>
            <button
              type="button"
              className={s.menuBtn}
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
              title="Open menu"
            >
              <Menu size={18} />
            </button>

            <Link to="/" className={s.logo}>
              <img className={s.logoIcon} src={ninerLogo} alt="NinerMarket" />
              <span className={s.logoText}>NinerMarket</span>
            </Link>
          </div>

          <div className={s.searchWrap}>
            <span className={s.searchIcon}>
              <Search size={15} />
            </span>
            <input
              className={s.searchInput}
              type="text"
              placeholder="Search listings, textbooks, dorm items..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSearch();
              }}
            />
          </div>

          <div className={s.navActions}>
            <button
              className={`${s.iconBtn} ${s.messagesNavBtn} ${
                messagesOpen ? s.iconBtnActive : ""
              }`}
              onClick={openMessagesOverlay}
              aria-label="Messages"
              title="Messages"
            >
              <MessageCircle size={16} />
              {totalUnread > 0 && <span className={s.notifDot} style={{ background: "#f87171" }} />}
            </button>

            {user && (
              <DropdownMenu.Root onOpenChange={(open) => open && loadNotifications()}>
                <DropdownMenu.Trigger asChild>
                  <button className={s.iconBtn} aria-label="Notifications" title="Notifications">
                    <Bell size={16} />
                    {unreadNotifs > 0 && <span className={s.notifDot} />}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className={s.notifMenu} align="end" sideOffset={8}>
                    <div className={s.notifMenuHeader}>
                      <span>Notifications</span>
                      {unreadNotifs > 0 && <span className={s.notifCount}>{unreadNotifs}</span>}
                    </div>
                    {notifications.length === 0 ? (
                      <p className={s.notifEmpty}>You're all caught up.</p>
                    ) : (
                      <div className={s.notifList}>
                        {groupNotifs(notifications)
                          .slice(0, 10)
                          .map((group) => {
                            const n = group[0];
                            const repeat = group.length;
                            return (
                              <DropdownMenu.Item
                                key={n.id}
                                className={`${s.notifItem} ${n.read ? "" : s.notifItemUnread}`}
                                onSelect={() => {
                                  group.forEach((item) => markNotificationRead(item.id));
                                  if (n.listing_id) openListingOverlay(n.listing_id);
                                }}
                              >
                                <span className={s.notifText}>
                                  {n.text}
                                  {repeat > 1 && (
                                    <span className={s.notifRepeat}>(x{repeat})</span>
                                  )}
                                </span>
                                <span className={s.notifTime}>
                                  {formatRelativeTime(n.created_at)}
                                </span>
                              </DropdownMenu.Item>
                            );
                          })}
                      </div>
                    )}
                    {unreadNotifs > 0 && (
                      <DropdownMenu.Item
                        className={s.notifClear}
                        onSelect={markAllNotificationsRead}
                      >
                        Mark all as read
                      </DropdownMenu.Item>
                    )}
                    {notifications.length > 0 && (
                      <DropdownMenu.Item
                        className={`${s.notifClear} ${s.notifClearDanger}`}
                        onSelect={clearNotifications}
                      >
                        Clear all
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}

            <button
              className={s.sellBtn}
              onClick={() => openSellForm()}
              aria-label="Sell an item"
              title="Sell an item"
            >
              <Plus size={14} />
              <span className={s.sellBtnLabel}>Sell</span>
            </button>

            {user && (
              <div className={s.profileWrap}>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className={s.navAvatar} aria-label="Your profile" title="Your profile">
                      <img src={avatarUrl(user.display_name, 64)} alt="Your profile" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className={s.profileMenu} align="end" sideOffset={8}>
                      <div className={s.profileMenuHeader}>
                        <p className={s.profileEmail}>{user.email}</p>
                        <p className={s.profileName}>{user.display_name}</p>
                      </div>
                      <DropdownMenu.Item
                        className={s.profileMenuItem}
                        onSelect={() => navigate(`/user/${user.id}`)}
                      >
                        <UserRound size={14} /> View profile
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={s.profileMenuItem}
                        onSelect={() => navigate("/?saved=1")}
                      >
                        <Heart size={14} /> Saved Items
                        {savedCount > 0 && <span className={s.countBadge}>{savedCount}</span>}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={s.profileMenuItem}
                        onSelect={() => navigate("/?mine=1")}
                      >
                        <ShoppingBag size={14} /> Your Listings
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={`${s.profileMenuItem} ${s.profileMenuItemDanger}`}
                        onSelect={handleLogout}
                      >
                        <LogOut size={14} /> Sign out
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className={s.body}>
        {mobileSidebarOpen && (
          <div
            className={s.sidebarBackdrop}
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside className={`${s.sidebar} ${mobileSidebarOpen ? s.sidebarOpen : ""}`}>
          <div className={s.sidebarHeader}>
            <h3 className={s.sidebarTitle}>Browse</h3>
            <button
              type="button"
              className={s.sidebarClose}
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>
          <div className={s.sidebarInner}>
            <div className={s.filtersSection}>
              <button
                type="button"
                className={s.filtersHeader}
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
              >
                <h3 className={s.filtersTitle}>Filters</h3>
                <ChevronDown
                  size={16}
                  className={`${s.filtersChevron} ${filtersOpen ? s.filtersChevronOpen : ""}`}
                />
              </button>

              {filtersOpen && filterFields}
            </div>

            <hr className={s.filtersDivider} />

            <nav className={s.catNav}>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = (params.get("category") ?? "all") === cat.id;
                return (
                  <Link
                    key={cat.id}
                    to={cat.id === "all" ? "/" : `/?category=${cat.id}`}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`${s.catBtn} ${active ? s.catBtnActive : ""}`}
                  >
                    <Icon size={20} className={active ? s.catIconActive : s.catIcon} />
                    {cat.label}
                    {active && <ChevronRight size={13} className={s.catChevron} />}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className={s.content}>
          <Outlet />
        </main>
        <div ref={fadeSentinelRef} aria-hidden="true" className={s.fadeSentinel} />
      </div>

      <div
        className={`${s.scrollFade} ${showScrollFade ? s.scrollFadeShow : ""}`}
        aria-hidden="true"
      />

      <nav className={s.bottomNav} aria-label="Bottom navigation">
        <Link
          to="/"
          className={`${s.bottomNavItem} ${pathname === "/" ? s.bottomNavActive : ""}`}
          aria-label="Home"
          title="Home"
        >
          <Home size={20} />
          <span>Home</span>
        </Link>

        <button
          type="button"
          className={s.bottomNavItem}
          onClick={openMessagesOverlay}
          aria-label="Messages"
          title="Messages"
        >
          <MessageCircle size={20} />
          <span>Messages</span>
          {totalUnread > 0 && <span className={s.bottomNavDot} />}
        </button>

        <button
          type="button"
          className={s.bottomNavItem}
          onClick={() => openSellForm()}
          aria-label="Sell an item"
          title="Sell an item"
        >
          <Plus size={20} />
          <span>Sell</span>
        </button>

        <Link
          to="/?saved=1"
          className={`${s.bottomNavItem} ${params.get("saved") === "1" ? s.bottomNavActive : ""}`}
          aria-label="Saved items"
          title="Saved items"
        >
          <Heart size={20} />
          <span>Saved</span>
        </Link>

        <Link
          to={user ? `/user/${user.id}` : "/login"}
          className={s.bottomNavItem}
          aria-label="Profile"
          title="Profile"
        >
          <UserRound size={20} />
          <span>Profile</span>
        </Link>
      </nav>

      <Modal
        open={!!sellModal}
        onOpenChange={(open) => !open && closeSellForm()}
        ariaLabel={sellModal?.mode === "edit" ? "Edit listing" : "Sell an item"}
        className={s.sellDialog}
      >
        <SellForm
          key={sellModal?.mode === "edit" ? sellModal.listing.id : "create"}
          listing={sellModal?.mode === "edit" ? sellModal.listing : undefined}
          onClose={closeSellForm}
          onSaved={(listing) => {
            if (sellModal?.mode === "edit") updateListing(listing);
            else addListing(listing);
            closeSellForm();
          }}
        />
      </Modal>

      <MessagesOverlay />
      <ListingOverlay />
    </div>
  );
}
