"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { EventApplicationService } from "@/application/EventApplicationService";
import { container } from "@/di/container";
import { DomainError } from "@/domain/DomainError";
import { Event } from "@/domain/event/Event";
import { EventPeriod } from "@/domain/event/EventPeriod";
import { Venue } from "@/domain/venue/Venue";
import { getLogger } from "@/logging/logger";
import { AccessDeniedError } from "@/security/AccessDeniedError";

export type EventActionResult = { success: false; message: string };

export async function createEventAction(
  formData: FormData,
): Promise<EventActionResult> {
  const session = await auth();
  const logger = await getLogger("createEvent");

  if (!session?.user.id) {
    const result: EventActionResult = {
      success: false,
      message: "催事を作成するにはログインしてください。",
    };

    logger.warn({ result }, result.message);

    return result;
  }

  const eventApplicationService = container.get(EventApplicationService);
  let eventId: string;

  try {
    const event = new Event(
      undefined,
      formData.get("title") as string,
      new Venue(formData.get("venueId") as string, ""),
      new EventPeriod(
        new Date(`${formData.get("startTime")}+09:00`),
        new Date(`${formData.get("endTime")}+09:00`),
      ),
      Number(formData.get("capacity")),
    );

    const createdEvent = await eventApplicationService.create(event);

    if (createdEvent.id === null) {
      throw new Error("Saved event ID is missing");
    }

    eventId = createdEvent.id;

    logger.info({ eventId, result: { success: true } }, "催事を作成しました。");
  } catch (error) {
    if (error instanceof ZodError) {
      const result: EventActionResult = {
        success: false,
        message: "入力内容を確認してください。催事名・会場・有効な日時・正の整数の定員が必要です。",
      };

      logger.warn({ result, err: error }, result.message);

      return result;
    }

    if (!(error instanceof DomainError) && !(error instanceof AccessDeniedError)) {
      throw error;
    }

    const result: EventActionResult = { success: false, message: error.message };

    logger.warn({ result, err: error }, result.message);

    return result;
  }

  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}
