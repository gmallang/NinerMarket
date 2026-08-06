import { useEffect, useRef } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { MessageCircle } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { useMarketStore } from "@/lib/store";
import { MessagingPage } from "./MessagingPage";
import m from "./Messaging.module.css";

export function MessagesOverlay() {
  const open = useMarketStore((s) => s.messagesOpen);
  const close = useMarketStore((s) => s.closeMessagesOverlay);
  const convs = useMarketStore((s) => s.convs);
  const activeConvId = useMarketStore((s) => s.activeConvId);
  const setActiveConvId = useMarketStore((s) => s.setActiveConvId);
  const listings = useMarketStore((s) => s.listings);
  const inputText = useMarketStore((s) => s.inputText);
  const setInputText = useMarketStore((s) => s.setInputText);
  const sendMessage = useMarketStore((s) => s.sendMessage);
  const openListingOverlay = useMarketStore((s) => s.openListingOverlay);

  const messagesEndRef: RefObject<HTMLDivElement> = useRef(null);
  const activeConv = convs.find((c) => c.id === activeConvId) ?? convs[0];
  const activeListing = listings.find((l) => l.id === activeConv?.listingId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convs, activeConvId, open]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      ariaLabel="Messages"
      className={m.overlayContent}
    >
      {activeConv ? (
        <MessagingPage
          onClose={close}
          convs={convs}
          activeConvId={activeConvId}
          onSelectConv={setActiveConvId}
          activeListing={activeListing}
          messagesEndRef={messagesEndRef}
          inputText={inputText}
          onInputChange={setInputText}
          onQuickReply={setInputText}
          onSend={sendMessage}
          onKeyDown={handleKeyDown}
          onOpenListing={activeListing ? () => openListingOverlay(activeListing.id) : undefined}
          className={m.overlayPanel}
        />
      ) : (
        <div className={m.overlayEmptyBox}>
          <MessageCircle size={28} />
          <p>No conversations yet.</p>
        </div>
      )}
    </Modal>
  );
}
