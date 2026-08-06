import type { KeyboardEvent, RefObject } from "react";
import { MessageCircle, X, Send } from "lucide-react";
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
  className = "",
}: MessagingPageProps) {
  const activeConv = convs.find((c) => c.id === activeConvId) ?? convs[0];

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
        <div className={m.convList}>
          <div className={m.convListHeader}>
            <span
              style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-fg-muted)" }}
            >
              Conversations
            </span>
          </div>
          <div className={m.convScroll}>
            {convs.map((conv) => (
              <div
                key={conv.id}
                className={`${m.convItem} ${conv.id === activeConvId ? m.convItemActive : ""}`}
                onClick={() => onSelectConv(conv.id)}
              >
                <div className={m.convAvatarWrap}>
                  <img
                    src={conv.avatar}
                    alt={conv.name}
                    className={m.convAvatar}
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
            ))}
          </div>
        </div>

        {/* Chat view */}
        <div className={m.chatView}>
          {/* Listing header */}
          {activeListing && (
            <button
              className={m.chatHeader}
              onClick={onOpenListing}
              disabled={!onOpenListing}
              aria-label={`View ${activeListing.title}`}
            >
              <img src={activeListing.image} alt={activeListing.title} className={m.chatThumb} />
              <div className={m.chatHeaderInfo}>
                <p className={m.chatListingTitle}>{activeListing.title}</p>
                <p className={m.chatListingPrice}>${activeListing.price.toLocaleString()}</p>
              </div>
            </button>
          )}

          {/* Messages */}
          <div className={m.messages}>
            <div className={m.dateDivider}>
              <div className={m.dateLine} />
              <span className={m.dateLabel}>Today</span>
              <div className={m.dateLine} />
            </div>

            {activeConv.messages.map((msg) => (
              <div key={msg.id} className={`${m.msgRow} ${msg.sent ? m.msgRowSent : ""}`}>
                {!msg.sent && (
                  <img
                    src={activeConv.avatar}
                    alt={activeConv.name}
                    className={m.msgRowAvatar}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = avatarUrl(activeConv.name, 56);
                    }}
                  />
                )}
                <div className={m.msgGroup}>
                  <div className={`${m.bubble} ${msg.sent ? m.bubbleSent : m.bubbleRecv}`}>
                    {msg.text}
                  </div>
                  <span className={m.msgTime}>{formatClockTime(new Date(msg.timestamp))}</span>
                </div>
              </div>
            ))}

            {activeConv.messages.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "var(--color-fg-muted)",
                  fontSize: "0.875rem",
                }}
              >
                Start the conversation!
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick replies */}
          <div className={m.quickReplies}>
            {QUICK_REPLIES.map((r) => (
              <button key={r} className={m.quickReply} onClick={() => onQuickReply(r)}>
                {r}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className={m.inputArea}>
            <div className={m.inputWrap}>
              <textarea
                className={m.msgInput}
                rows={1}
                placeholder={`Message ${activeConv.name}...`}
                value={inputText}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
            <button
              className={`${m.sendBtn} ${!inputText.trim() ? m.sendBtnDisabled : ""}`}
              onClick={onSend}
              disabled={!inputText.trim()}
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
