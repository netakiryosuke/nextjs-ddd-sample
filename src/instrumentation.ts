import type { Instrumentation } from "next";

const TIME_ZONE = "Asia/Tokyo";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = TIME_ZONE;

    const { container } = await import("./di/container");
    const { EventApplicationService } = await import(
      "./application/EventApplicationService"
    );
    const { ReservationApplicationService } = await import(
      "./application/ReservationApplicationService"
    );

    container.get(EventApplicationService);
    container.get(ReservationApplicationService);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { logger } = await import("./logging/logger");

  logger.error(
    {
      err: error,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      digest:
        error instanceof Error && "digest" in error ? error.digest : undefined,
    },
    "未処理のサーバーエラーが発生しました。",
  );
};
