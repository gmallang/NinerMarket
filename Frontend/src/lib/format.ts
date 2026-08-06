import { differenceInDays, differenceInHours, differenceInMinutes, format } from "date-fns";

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const now = new Date();
  const mins = differenceInMinutes(now, then);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = differenceInHours(now, then);
  if (hours < 24) return `${hours}h ago`;
  const days = differenceInDays(now, then);
  if (days < 7) return `${days}d ago`;
  return format(then, "MMM d, yyyy");
}

export function formatClockTime(date: Date = new Date()): string {
  return format(date, "h:mm a");
}
