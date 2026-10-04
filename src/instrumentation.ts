const TIME_ZONE = "Asia/Tokyo";

export function register(): void {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = TIME_ZONE;
  }
}
