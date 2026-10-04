const TIME_ZONE = "Asia/Tokyo";

const eventDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatEventDateTime(dateTime: Date): string {
  return eventDateTimeFormatter.format(dateTime);
}
