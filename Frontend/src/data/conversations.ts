// Conversation seed data (local; messaging backend not built yet)

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) => minutesAgo(n * 60);
const daysAgo = (n: number) => hoursAgo(n * 24);

export interface Message {
  id: number;
  text: string;
  sent: boolean;
  timestamp: string;
  isOptimistic?: boolean;
}

export interface Conversation {
  id: number;
  listingId: string;
  name: string;
  avatar: string;
  online: boolean;
  unread: number;
  lastMsg: string;
  lastTimestamp: string;
  messages: Message[];
  other_user_id?: string;
  other_read_cursor?: number;
}

export const CONVS: Conversation[] = [
  {
    id: 1,
    listingId: "4",
    name: "Chris L.",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format",
    online: true,
    unread: 2,
    lastMsg: "Is it still available?",
    lastTimestamp: hoursAgo(3),
    messages: [
      { id: 1, text: "Hey! Is the MacBook still available?", sent: false, timestamp: hoursAgo(8) },
      {
        id: 2,
        text: "Yes it is! Just listed it yesterday.",
        sent: true,
        timestamp: minutesAgo(8 * 60 - 2),
      },
      {
        id: 3,
        text: "What's the lowest you'd go?",
        sent: false,
        timestamp: minutesAgo(8 * 60 - 3),
      },
      {
        id: 4,
        text: "I could do $1,050 if you pick up today.",
        sent: true,
        timestamp: hoursAgo(7),
      },
      { id: 5, text: "Is it still available?", sent: false, timestamp: hoursAgo(3) },
    ],
  },
  {
    id: 2,
    listingId: "1",
    name: "Maya T.",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format",
    online: false,
    unread: 0,
    lastMsg: "Can you hold it til Friday?",
    lastTimestamp: daysAgo(1),
    messages: [
      {
        id: 1,
        text: "Hi! Is the Organic Chem book in good shape?",
        sent: false,
        timestamp: hoursAgo(26),
      },
      {
        id: 2,
        text: "Yep, no highlighting, all pages intact.",
        sent: true,
        timestamp: minutesAgo(26 * 60 - 5),
      },
      {
        id: 3,
        text: "Can you hold it til Friday?",
        sent: false,
        timestamp: minutesAgo(26 * 60 - 10),
      },
    ],
  },
  {
    id: 3,
    listingId: "5",
    name: "Sam R.",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format",
    online: true,
    unread: 2,
    lastMsg: "Meet at the bike rack?",
    lastTimestamp: hoursAgo(6),
    messages: [
      { id: 1, text: "Does the bike come with a lock?", sent: false, timestamp: hoursAgo(7) },
      {
        id: 2,
        text: "No lock, but I can throw in the pump.",
        sent: true,
        timestamp: minutesAgo(7 * 60 - 2),
      },
      { id: 3, text: "Deal! Meet at the bike rack?", sent: false, timestamp: hoursAgo(6) },
    ],
  },
  {
    id: 4,
    listingId: "7",
    name: "Olivia M.",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&h=80&fit=crop&auto=format",
    online: false,
    unread: 1,
    lastMsg: "Does the fridge smell?",
    lastTimestamp: daysAgo(2),
    messages: [{ id: 1, text: "Does the fridge smell?", sent: false, timestamp: daysAgo(2) }],
  },
];

export const QUICK_REPLIES = [
  "Is it still available?",
  "Can you do lower?",
  "Where can we meet?",
  "I'll take it!",
];
