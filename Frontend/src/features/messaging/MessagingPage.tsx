import type { KeyboardEvent, RefObject } from "react";
import { useState } from "react";
import { ArrowLeft, MessageCircle, X, Send, Search } from "lucide-react";
import type { Listing } from "@/lib/types";
import { avatarUrl } from "@/lib/avatar";
import { formatClockTime, formatRelativeTime } from "@/lib/format";
import { QUICK_REPLIES } from "@/data/conversations";
import type { Conversation } from "@/data/conversations";
import m from "./Messaging.module.css";

// ─── Messaging page ─────────────────────────────────────────────────────────

interface MessagingPageProps {
  onClose: () => void;
  convs: Conversation[];
  activeConvId: number;
  onSelectConv: (id: number) => void;
  activeListing?: Listing;
  messagesEndRef: RefObject<HTMLDivElement>;
  inputText: string;
  onInputChange: (text: string) => void;
  onQuickReply: (text: string) => void;
  onSend: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onOpenListing?: () => void;
  typingIndicator?: boolean;
  threadsLoading?: boolean;
  className?: string;
}

export function MessagingPage({
  onClose,
  convs,
  activeConvId,
  onSelectConv,
  activeListing,
  messagesEndRef,
  inputText,
  onInputChange,
  onQuickReply,
  onSend,
  onKeyDown,
  onOpenListing,
  typingIndicator = false,
  threadsLoading = false,
  className = "",
}: MessagingPageProps) {
  const activeConv = convs.find((c) => c.id === activeConvId) ?? convs[0];

  // On mobile the conversation list is hidden and the user navigates
  // list -> chat -> back; on desktop both panes always render.
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filteredConvs = query
    ? convs.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.lastMsg ?? "").toLowerCase().includes(query)
      )
    : convs;

  return (
    <div className={`${m.panel} ${className}`}>
      {/* Panel header */}
      <div className={m.panelHeader}>
        <MessageCircle size={18} color="#fff" />
        <span className={m.panelTitle}>Messages</span>
        <button className={m.closeBtn} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className={m.panelBody}>
        {/* Conversation list */}
        <div
          className={`${m.convList} ${
            mobileView === "list" ? m.convListVisible : m.convListHidden
          }`}
        >
          <div className={m.convListHeader}>
            <span
              style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-fg-muted)" }}
            >
              Conversations
            </span>
          </div>
          <div className={m.convSearchWrap}>
            <Search size={14} className={m.convSearchIcon} />
            <input
              className={m.convSearch}
              type="text"
              placeholder="Search conversations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search conversations"
            />
          </div>
          <div className={m.convScroll}>
            {threadsLoading && filteredConvs.length === 0 ? (
              <div className={m.convSkeleton} aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={m.convSkeletonRow}>
                    <div className={m.convSkeletonAvatar} />
                    <div className={m.convSkeletonMeta}>
                      <div className={m.convSkeletonLine} style={{ width: "45%" }} />
                      <div className={m.convSkeletonLine} style={{ width: "75%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              filteredConvs.map((conv) => (
              <div
                key={conv.id}
                className={`${m.convItem} ${conv.id === activeConvId ? m.convItemActive : ""}`}
                onClick={() => {
                  onSelectConv(conv.id);
                  setMobileView("chat");
                }}
              >
                <div className={m.convAvatarWrap}>
                  <img
                    src={conv.avatar}
                    alt={conv.name}
                    className={m.convAvatar}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = avatarUrl(conv.name, 80);
                    }}
                  />
                  {conv.online && <span className={m.onlineDot} />}
                </div>
                <div className={m.convMeta}>
                  <div className={m.convTopRow}>
                    <span className={m.convName}>{conv.name}</span>
                    <span className={m.convTime}>{formatRelativeTime(conv.lastTimestamp)}</span>
                  </div>
                  <p className={m.convPreview}>{conv.lastMsg || "New conversation"}</p>
                </div>
                {conv.unread > 0 && <span className={m.convUnread}>{conv.unread}</span>}
              </div>
              ))
            )}
            {!threadsLoading && filteredConvs.length === 0 && (
              <p className={m.convEmpty}>No conversations found</p>
            )}
          </div>
        </div>

        {/* Chat view */}
        <div className={`${m.chatView} ${mobileView === "list" ? m.chatViewHidden : ""}`}>
          {/* Listing header with mobile back button */}
          {activeListing ? (
            <div className={m.chatHeader}>
              <button
                className={m.backBtn}
                onClick={() => setMobileView("list")}
                aria-label="Back to conversations"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                className={m.chatHeaderMain}
                onClick={onOpenListing}
                disabled={!onOpenListing}
                aria-label={`View ${activeListing.title}`}
              >
                <img src={activeListing.image} alt={activeListing.title} className={m.chatThumb} loading="lazy" decoding="async" />
                <div className={m.chatHeaderInfo}>
                  <p className={m.chatListingTitle}>{activeListing.title}</p>
                  <p className={m.chatListingPrice}>${activeListing.price.toLocaleString()}</p>
                </div>
              </button>
            </div>
          ) : (
            <div className={m.chatMobileBar}>
              <button
                className={m.backBtn}
                onClick={() => setMobileView("list")}
                aria-label="Back to conversations"
              >
                <ArrowLeft size={18} />
              </button>
              <span className={m.chatMobileName}>{activeConv.name}</span>
            </div>
          )}

          {/* Messages */}
          <div className={m.messages}>
            {activeConv.messages.length === 0 && (
              <div className={m.messagesEmpty}>Start the conversation!</div>
            )}

            <div className={m.messagesInner}>
              <div className={m.dateDivider}>
                <div className={m.dateLine} />
                <span className={m.dateLabel}>Today</span>
                <div className={m.dateLine} />
              </div>

              {activeConv.messages.map((msg, index, msgs) => {
                const isLastMsg = index === msgs.length - 1;
                const read =
                  activeConv.other_read_cursor != null && msg.id <= activeConv.other_read_cursor;
                return (
                  <div key={msg.id} className={`${m.msgRow} ${msg.sent ? m.msgRowSent : ""}`}>
                    <div className={m.msgBubbleRow}>
                      {!msg.sent && (
                        <img
                          src={activeConv.avatar}
                          alt={activeConv.name}
                          className={m.msgRowAvatar}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = avatarUrl(activeConv.name, 56);
                          }}
                        />
                      )}
                      <div className={`${m.bubble} ${msg.sent ? m.bubbleSent : m.bubbleRecv}`}>
                        {msg.text}
                      </div>
                    </div>
                    <span className={m.msgTime}>
                      {formatClockTime(new Date(msg.timestamp))}
                      {isLastMsg && msg.sent && read && (
                        <span className={m.msgRead}> · Read</span>
                      )}
                    </span>
                  </div>
                );
              })}

                  {typingIndicator && (
                    <div className={m.msgRow}>
                      <div className={m.msgBubbleRow}>
                        <img
                          src={activeConv.avatar}
                          alt={activeConv.name}
                          className={m.msgRowAvatar}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = avatarUrl(activeConv.name, 56);
                          }}
                        />
                    <div className={`${m.bubble} ${m.bubbleRecv} ${m.typingBubble}`}>
                      <span className={m.typingDot} />
                      <span className={m.typingDot} />
                      <span className={m.typingDot} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area (quick replies + composer) */}
          <div className={m.inputArea}>
            <div className={m.inputWrap}>
              <div className={m.quickReplies}>
                {QUICK_REPLIES.map((r) => (
                  <button key={r} className={m.quickReply} onClick={() => onQuickReply(r)}>
                    {r}
                  </button>
                ))}
              </div>
              <div className={m.inputRow}>
                <textarea
                  className={m.msgInput}
                  rows={1}
                  placeholder={`Message ${activeConv.name}...`}
                  value={inputText}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={onKeyDown}
                />
                <button
                  className={`${m.sendBtn} ${!inputText.trim() ? m.sendBtnDisabled : ""}`}
                  onClick={onSend}
                  disabled={!inputText.trim()}
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
