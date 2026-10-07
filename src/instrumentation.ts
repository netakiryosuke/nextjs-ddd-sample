const TIME_ZONE = "Asia/Tokyo";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = TIME_ZONE;

    const { container } = await import("./di/container");
    const { EventApplicationService } = await import(
      "./application/event/EventApplicationService"
    );
    const { ReservationApplicationService } = await import(
      "./application/reservation/ReservationApplicationService"
    );

    container.get(EventApplicationService);
    container.get(ReservationApplicationService);
  }
}
