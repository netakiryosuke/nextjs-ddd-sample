import "server-only";
import { randomUUID } from "node:crypto";
import pino from "pino";
import { auth } from "@/auth";

export const logger = pino({
  level: "info",
  timestamp: pino.stdTimeFunctions.isoTime,
});

export async function getLogger(action: string): Promise<pino.Logger> {
  const session = await auth();

  return logger.child({
    action,
    requestId: randomUUID(),
    userId: session?.user.id,
  });
}
