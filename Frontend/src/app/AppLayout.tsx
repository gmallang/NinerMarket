import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  MessageCircle,
  Plus,
  LogOut,
  UserRound,
  Heart,
  ShoppingBag,
  Bell,
  Menu,
  X,
  Home,
  CheckCircle2,
  Megaphone,
  ChevronDown,
  ChevronLeft,
  SlidersHorizontal,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import ninerLogo from "@/assets/NinerMarket.png";
import { avatarUrl } from "@/lib/avatar";
import { useMarketStore } from "@/lib/store";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/data/categories";
import { LOCATION_GROUPS } from "@/data/locations";
import { Modal } from "@/components/shared/Modal";
import { SellForm } from "@/features/sell/SellForm";
import { RequestForm } from "@/components/requests/RequestForm";
import { MessagesOverlay } from "@/features/messaging/MessagesOverlay";
import { ListingOverlay } from "@/features/listings/ListingOverlay";
import { formatRelativeTime } from "@/lib/format";
import { pushSupported } from "@/lib/push";
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
  const pushEnabled = useMarketStore((s) => s.pushEnabled);
  const pushPromptDismissed = useMarketStore((s) => s.pushPromptDismissed);
  const checkPushEnabled = useMarketStore((s) => s.checkPushEnabled);
  const enablePushNotifications = useMarketStore((s) => s.enablePushNotifications);
  const dismissPushPrompt = useMarketStore((s) => s.dismissPushPrompt);
  const openListingOverlay = useMarketStore((s) => s.openListingOverlay);
  const openMessageOverlayWithBuyer = useMarketStore((s) => s.openMessageOverlayWithBuyer);
  const logout = useMarketStore((s) => s.logout);
  const refreshProfile = useMarketStore((s) => s.refreshProfile);
  const addListing = useMarketStore((s) => s.addListing);
  const updateListing = useMarketStore((s) => s.updateListing);
  const sellModal = useMarketStore((s) => s.sellModal);
  const openSellForm = useMarketStore((s) => s.openSellForm);
  const closeSellForm = useMarketStore((s) => s.closeSellForm);
  const requestModal = useMarketStore((s) => s.requestModal);
  const closeRequestForm = useMarketStore((s) => s.closeRequestForm);
  const messagesOpen = useMarketStore((s) => s.messagesOpen);
  const openMessagesOverlay = useMarketStore((s) => s.openMessagesOverlay);
  const loadSaved = useMarketStore((s) => s.loadSaved);
  const requestsVersion = useMarketStore((s) => s.requestsVersion);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [activeRequestCount, setActiveRequestCount] = useState<number | null>(null);
  const [minPriceInput, setMinPriceInput] = useState(params.get("minPrice") ?? "");
  const [maxPriceInput, setMaxPriceInput] = useState(params.get("maxPrice") ?? "");
  const [showScrollFade, setShowScrollFade] = useState(false);
  const [pushError, setPushError] = useState("");
  const [sellSuccess, setSellSuccess] = useState(false);
  const fadeSentinelRef = useRef<HTMLDivElement | null>(null);
  const totalUnread = convs.reduce((n, c) => n + c.unread, 0);
  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const activeConditions = (params.get("condition") ?? "").split(",").filter(Boolean);
  const activeCategory = params.get("category") ?? "all";
  const activeLocation = params.get("location") ?? "";
  const onlyAvailable = params.get("available") !== "0";
  // Only regroup notifications when the list actually changes.
  const groupedNotifs = useMemo(() => groupNotifs(notifications), [notifications]);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (pathname !== "/") setQ("");
  }

  // Listings are loaded by HomePage, which owns the URL-driven filters; a
  // fetch here would race it and overwrite the filtered page with page one.
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (user) {
      void loadSaved();
      void loadNotifications();
      void loadThreads();
      void checkPushEnabled();
      startRealtimeInbox();
      startRealtimeListings();
    }
  }, [user, loadSaved, loadNotifications, loadThreads, checkPushEnabled, startRealtimeInbox, startRealtimeListings]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Drives the "N requests" badge in the sidebar's Browse shortcuts.
  useEffect(() => {
    let alive = true;
    api
      .listRequests({ status: "active", limit: 1 })
      .then(({ items, total }) => {
        if (alive) setActiveRequestCount(total ?? items.length);
      })
      .catch(() => {
        if (alive) setActiveRequestCount(null);
      });
    return () => {
      alive = false;
    };
  }, [requestsVersion]);

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
      // A changed search always starts from the first page of results.
      next.delete("page");
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
    next.delete("page");
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    navigate(`/?${next.toString()}`);
  };

  const applyFilter = (key: string, value: string) => {
    const next = new URLSearchParams(pathname === "/" ? params : undefined);
    if (value) next.set(key, value);
    else next.delete(key);
    // Changing a filter invalidates the current page number.
    next.delete("page");
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

  const resetFilters = () => {
    setMinPriceInput("");
    setMaxPriceInput("");
    navigate("/");
  };

  const applyPriceRange = () => {
    const next = new URLSearchParams(pathname === "/" ? params : undefined);
    if (minPriceInput.trim()) next.set("minPrice", minPriceInput.trim());
    else next.delete("minPrice");
    if (maxPriceInput.trim()) next.set("maxPrice", maxPriceInput.trim());
    else next.delete("maxPrice");
    next.delete("page");
    const qs = next.toString();
    navigate(qs ? `/?${qs}` : "/");
  };

  const FILTER_CONDITIONS = ["New", "Like New", "Good", "Fair"];

  const marketplaceActive =
    pathname === "/" && !params.get("saved") && !params.get("mine") && !params.get("view");
  const requestsActive = pathname.startsWith("/requests");

  const filterFields = (
    <>
      <div className={`${s.filterGroup} ${s.browseGroup}`}>
        <label className={s.filterLabel}>Browse</label>
        <p className={s.browseEyebrow}>Marketplace</p>
        <div className={s.browseList}>
          <Link
            to="/"
            className={`${s.browseCard} ${marketplaceActive ? s.browseCardActive : ""}`}
            aria-current={marketplaceActive ? "page" : undefined}
          >
            <span className={s.browseTop}>
              <span className={s.browseName}>For Sale</span>
              <span className={s.browseBadge}>
                <span className={s.browseDot} aria-hidden="true" />
                Active
              </span>
            </span>
            <span className={s.browseDesc}>Browse items listed by fellow Niners.</span>
          </Link>
          <Link
            to="/requests"
            className={`${s.browseCard} ${requestsActive ? s.browseCardActive : ""}`}
            aria-current={requestsActive ? "page" : undefined}
          >
            <span className={s.browseTop}>
              <span className={s.browseName}>Looking For</span>
              <span className={s.browseBadge}>
                {activeRequestCount == null
                  ? "Requests"
                  : `${activeRequestCount} ${activeRequestCount === 1 ? "request" : "requests"}`}
              </span>
            </span>
            <span className={s.browseDesc}>Find what students are searching for.</span>
          </Link>
        </div>
      </div>

      <div className={`${s.filterGroup} ${s.categoryGroup}`}>
        <label className={s.filterLabel} htmlFor="category-filter">
          Category
        </label>
        <select
          id="category-filter"
          className={`${s.filterSelect} ${s.selectControl}`}
          value={activeCategory}
          onChange={(event) =>
            applyFilter("category", event.target.value === "all" ? "" : event.target.value)
          }
        >
          <option value="all">All Categories</option>
          {CATEGORIES.filter((category) => category.id !== "all").map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
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
            placeholder="$ Min"
            value={minPriceInput}
            onChange={(e) => setMinPriceInput(e.target.value)}
            onBlur={applyPriceRange}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyPriceRange();
            }}
          />
          <input
            className={s.filterInputSmall}
            type="number"
            min={0}
            placeholder="$ Max"
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(e.target.value)}
            onBlur={applyPriceRange}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyPriceRange();
            }}
          />
          <button
            type="button"
            className={s.priceApply}
            onClick={applyPriceRange}
            aria-label="Apply price range"
            title="Apply price range"
          >
            <ChevronDown size={14} className={s.priceApplyIcon} />
          </button>
        </div>
      </div>

      <div className={s.filterGroup}>
        <label className={s.filterLabel}>Condition</label>
        <div className={s.checkboxList}>
          {FILTER_CONDITIONS.map((condition) => (
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

      <div className={s.filterGroup}>
        <label className={s.filterLabel} htmlFor="location-filter">
          Location
        </label>
        <select
          id="location-filter"
          className={`${s.filterSelect} ${s.selectControl}`}
          value={activeLocation || "all"}
          onChange={(event) =>
            applyFilter("location", event.target.value === "all" ? "" : event.target.value)
          }
        >
          <option value="all">All Locations</option>
          {LOCATION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className={s.filterGroup}>
        <label className={s.filterLabel}>Sort By</label>
        <select
          className={s.filterSelect}
          value={params.get("sort") ?? "recent"}
          onChange={(e) => applyFilter("sort", e.target.value)}
        >
          <option value="recent">Newest First</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </div>

      <div className={s.filterGroup}>
        <label className={s.filterLabel}>Availability</label>
        <div className={s.checkboxList}>
          <label className={s.checkboxRow}>
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={() => applyFilter("available", onlyAvailable ? "0" : "")}
            />
            Show only available
          </label>
        </div>
      </div>
    </>
  );

  return (
    <div className={`${s.page} ${filtersCollapsed ? s.pageFiltersCollapsed : ""}`}>
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
                    {unreadNotifs > 0 && (
                      <span className={s.notifBadge}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>
                    )}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className={s.notifMenu} align="end" sideOffset={8}>
                    <div className={s.notifMenuHeader}>
                      <span>Notifications</span>
                      {unreadNotifs > 0 && <span className={s.notifCount}>{unreadNotifs}</span>}
                    </div>
                    {pushSupported() && !pushEnabled && !pushPromptDismissed && (
                      <div className={s.pushPrompt}>
                        <span>Get notified even when NinerMarket isn't open.</span>
                        {pushError && <span className={s.pushPromptError}>{pushError}</span>}
                        <div className={s.pushPromptActions}>
                          <button
                            className={s.pushPromptBtn}
                            onClick={(e) => {
                              e.preventDefault();
                              setPushError("");
                              void enablePushNotifications().then((status) => {
                                if (status === "ok") return;
                                void checkPushEnabled();
                                setPushError(
                                  status === "nokey"
                                    ? "Push isn't configured on the server yet — try again later."
                                    : status === "denied"
                                      ? "Blocked — enable notifications for this site in your browser settings."
                                      : "Not available yet — check back soon."
                                );
                              });
                            }}
                          >
                            Enable
                          </button>
                          <button
                            className={s.pushPromptDismiss}
                            onClick={(e) => {
                              e.preventDefault();
                              dismissPushPrompt();
                            }}
                          >
                            Not now
                          </button>
                        </div>
                      </div>
                    )}
                    {notifications.length === 0 ? (
                      <p className={s.notifEmpty}>You're all caught up.</p>
                    ) : (
                      <div className={s.notifList}>
                        {groupedNotifs
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
                                  if (n.related_user_id && n.listing_id) {
                                    openMessageOverlayWithBuyer(
                                      n.listing_id,
                                      n.related_user_id,
                                      n.related_user_name ?? ""
                                    );
                                  } else if (n.listing_id) {
                                    openListingOverlay(n.listing_id);
                                  }
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
              <Plus size={17} />
              <span className={s.sellBtnLabel}>Sell</span>
            </button>

            {user && (
              <div className={s.profileWrap}>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      className={s.profilePill}
                      aria-label="Your profile"
                      title="Your profile"
                    >
                      <img
                        className={s.profilePillAvatar}
                        src={avatarUrl(user.display_name, 64)}
                        alt="Your profile"
                        loading="lazy"
                        decoding="async"
                      />
                      <ChevronDown size={14} className={s.profileChevron} />
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
                        className={s.profileMenuItem}
                        onSelect={() => navigate("/requests/mine")}
                      >
                        <Megaphone size={14} /> My Requests
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
        <aside
          className={`${s.sidebar} ${mobileSidebarOpen ? s.sidebarOpen : ""} ${
            filtersCollapsed ? s.sidebarCollapsed : ""
          }`}
          aria-label="Filters"
        >
          <div className={s.sidebarHeader}>
            <h3 className={s.sidebarTitle}>
              <SlidersHorizontal size={16} />
              <span className={s.sidebarTitleText}>Filters</span>
            </h3>
            <div className={s.sidebarHeaderActions}>
              <button type="button" className={s.resetBtn} onClick={resetFilters}>
                Reset
              </button>
              <button
                type="button"
                className={s.sidebarCollapse}
                onClick={() => setFiltersCollapsed((v) => !v)}
                aria-expanded={!filtersCollapsed}
                aria-controls="filter-fields"
                aria-label={filtersCollapsed ? "Expand filters" : "Collapse filters"}
                title={filtersCollapsed ? "Expand filters" : "Collapse filters"}
              >
                <ChevronLeft
                  size={16}
                  className={filtersCollapsed ? s.sidebarCollapseIconFlipped : undefined}
                />
              </button>
              <button
                type="button"
                className={s.sidebarClose}
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close filters"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className={s.sidebarInner} id="filter-fields">
            {filterFields}
          </div>
        </aside>

        <main className={s.content}>
          <Outlet />
        </main>
      </div>

      {/* Sits at the top of the footer so the scroll fade switches off before
          the footer scrolls into view. */}
      <div ref={fadeSentinelRef} aria-hidden="true" className={s.fadeSentinel} />

      <footer className={s.siteFooter}>
        <div className={s.siteFooterInner}>
          <span>© 2026 NinerMarket</span>
          <Link to="/privacy" className={s.siteFooterLink}>
            Privacy Policy
          </Link>
        </div>
      </footer>

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
            if (sellModal?.mode === "edit") {
              updateListing(listing);
            } else {
              addListing(listing);
              setSellSuccess(true);
              window.setTimeout(() => setSellSuccess(false), 2600);
            }
            closeSellForm();
          }}
        />
      </Modal>

      {sellSuccess && (
        <div className={s.sellSuccessToast} role="status">
          <CheckCircle2 size={18} />
          Listing posted!
        </div>
      )}

      <Modal
        open={!!requestModal}
        onOpenChange={(open) => !open && closeRequestForm()}
        ariaLabel={requestModal?.mode === "edit" ? "Edit request" : "Post a request"}
        className={s.sellDialog}
      >
        <RequestForm
          key={requestModal?.mode === "edit" ? requestModal.request.id : "create"}
          request={requestModal?.mode === "edit" ? requestModal.request : undefined}
          onClose={closeRequestForm}
        />
      </Modal>

      <MessagesOverlay />
      <ListingOverlay />
    </div>
  );
}
