import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMarketStore } from "@/lib/store";
import { api } from "@/lib/api";
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
      user: null,
      convs: [CONV],
      listings: [LISTING],
      activeConvId: 11,
      inputText: "",
      messagesOpen: false,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("keeps a sent message when an older thread refresh resolves afterward", async () => {
    const user = { id: "u-me", email: "me@charlotte.edu", display_name: "Me" };
    let resolveThreads: (threads: typeof CONV[]) => void = () => {};
    const oldThread = { ...CONV, messages: [...CONV.messages] };
    const threadsRequest = new Promise<typeof CONV[]>((resolve) => {
      resolveThreads = resolve;
    });
    vi.spyOn(api, "getThreads").mockReturnValueOnce(threadsRequest);
    vi.spyOn(api, "sendThreadMessage").mockResolvedValueOnce({
      ...CONV,
      lastMsg: "Still here",
      lastTimestamp: new Date().toISOString(),
      messages: [
        ...CONV.messages,
        { id: 2, text: "Still here", sent: true, timestamp: new Date().toISOString() },
      ],
    });
    useMarketStore.setState({ user, messagesOpen: true });

    const loading = useMarketStore.getState().loadThreads();
    useMarketStore.getState().setInputText("Still here");
    useMarketStore.getState().sendMessage();
    resolveThreads([oldThread]);
    await loading;

    expect(useMarketStore.getState().convs[0].messages.map((message) => message.text)).toContain(
      "Still here"
    );
  });

  it("removes the optimistic bubble when the send fails", async () => {
    const user = userEvent.setup();
    useMarketStore.setState({
      user: { id: "u-me", email: "me@charlotte.edu", display_name: "Me" },
      messagesOpen: true,
    });
    vi.spyOn(api, "sendThreadMessage").mockRejectedValueOnce(new Error("Network unavailable"));
    render(<MessagesOverlay />);

    await user.type(screen.getByPlaceholderText("Message Maya T...."), "This will fail");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.queryByText("This will fail")).not.toBeInTheDocument();
    });
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
