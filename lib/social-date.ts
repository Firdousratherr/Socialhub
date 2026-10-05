const absoluteFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const joinedFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function asDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSocialDate(value: string | Date, now = new Date()) {
  const date = asDate(value);
  if (!date) return "Unknown date";

  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m";

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";

  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d";

  return absoluteFormatter.format(date);
}

export function formatSocialDateTime(value: string | Date) {
  const date = asDate(value);
  return date ? dateTimeFormatter.format(date) : "Unknown date";
}

export function formatJoinedDate(value: string | Date) {
  const date = asDate(value);
  return date ? joinedFormatter.format(date) : "Unknown date";
}
