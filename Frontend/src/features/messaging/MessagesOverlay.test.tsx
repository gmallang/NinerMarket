import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useMarketStore } from "@/lib/store";
import type { Listing } from "@/lib/types";
import { MessagesOverlay } from "./MessagesOverlay";

const CONV = {
  id: 11,
  listingId: "1",
  name: "Maya T.",
  avatar: "https://example.com/avatar.png",
  online: true,
  unread: 0,
  lastMsg: "Hey! Still available?",
  lastTimestamp: new Date().toISOString(),
  messages: [
    { id: 1, text: "Hey! Still available?", sent: false, timestamp: new Date().toISOString() },
  ],
};

const LISTING: Listing = {
  id: "1",
  title: "Chemistry Textbook",
  price: 45,
  category: "textbooks",
  campus: "North Campus",
  time: "2h ago",
  createdAt: "2026-01-01T10:00:00.000Z",
  condition: "Good",
  image: "https://example.com/book.jpg",
  seller: "Maya T.",
  sellerId: "u-1",
  sellerRating: 4.9,
  status: "active",
};

describe("MessagesOverlay", () => {
  beforeEach(() => {
    useMarketStore.setState({
      convs: [CONV],
      listings: [LISTING],
      activeConvId: 11,
      inputText: "",
      messagesOpen: false,
    });
  });

  it("is closed by default", () => {
    render(<MessagesOverlay />);
    expect(screen.queryByText("Chemistry Textbook")).not.toBeInTheDocument();
  });

  it("shows the conversation list and chat when open", () => {
    useMarketStore.setState({ messagesOpen: true });
    render(<MessagesOverlay />);
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("Chemistry Textbook")).toBeInTheDocument();
    expect(screen.getAllByText("Hey! Still available?")).toHaveLength(2);
    expect(screen.getByText("$45")).toBeInTheDocument();
  });

  it("sends a message from the overlay", async () => {
    useMarketStore.setState({ messagesOpen: true });
    const user = userEvent.setup();
    render(<MessagesOverlay />);
    await user.type(screen.getByPlaceholderText("Message Maya T...."), "Yes, it is!");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getAllByText("Yes, it is!")).toHaveLength(2);
    expect(useMarketStore.getState().convs[0].lastMsg).toBe("Yes, it is!");
  });

  it("shows a typing indicator when the other person is typing", () => {
    useMarketStore.setState({ messagesOpen: true, typingByConvId: { 11: true } });
    render(<MessagesOverlay />);
    expect(document.querySelector('[class*="typingBubble"]')).toBeInTheDocument();
  });

  it("hides the typing indicator once it's no longer set", () => {
    useMarketStore.setState({ messagesOpen: true, typingByConvId: { 11: false } });
    render(<MessagesOverlay />);
    expect(document.querySelector('[class*="typingBubble"]')).not.toBeInTheDocument();
  });
});
