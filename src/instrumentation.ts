const TIME_ZONE = "Asia/Tokyo";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = TIME_ZONE;

    const { container } = await import("./di/container");
    const { EventApplicationService } = await import(
      "./application/event/EventApplicationService"
    );

    // 利用するサービスの依存設定を、リクエスト受付前に検証する。
    container.get(EventApplicationService);
  }
}
