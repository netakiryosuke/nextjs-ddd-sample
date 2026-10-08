"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DomainError } from "@/domain/DomainError";
import { ReservationApplicationService } from "@/application/ReservationApplicationService";
import { container } from "@/di/container";
import { auth } from "@/auth";
import { getLogger } from "@/logging/logger";

const idSchema = z.uuid();

export type ReservationActionResult =
  | { success: true; reservationId: string | null; message: string }
  | { success: false; message: string };

export async function reserveAction(
  eventId: string,
): Promise<ReservationActionResult> {
  const session = await auth();
  const logger = await getLogger("reserve");

  if (!session?.user.id) {
    const result: ReservationActionResult = {
      success: false,
      message: "予約するにはログインしてください。",
    };

    logger.warn({ eventId, result }, result.message);

    return result;
  }

  const parsed = idSchema.safeParse(eventId);

  if (!parsed.success) {
    const result: ReservationActionResult = {
      success: false,
      message: "催事IDが正しくありません。",
    };

    logger.warn({ eventId, result, err: parsed.error }, result.message);

    return result;
  }

  const reservationApplicationService = container.get(
    ReservationApplicationService,
  );

  try {
    const reservation = await reservationApplicationService.reserve(
      parsed.data,
      session.user.id,
    );

    revalidatePath(`/events/${reservation.eventId}`);

    const result: ReservationActionResult = {
      success: true,
      reservationId: reservation.id,
      message: "予約が完了しました。",
    };

    logger.info({ eventId, result }, result.message);

    return result;
  } catch (error) {
    if (!(error instanceof DomainError)) {
      throw error;
    }

    const result: ReservationActionResult = {
      success: false,
      message: error.message,
    };

    logger.warn({ eventId, result, err: error }, result.message);

    return result;
  }
}

export async function cancelAction(
  reservationId: string,
): Promise<ReservationActionResult> {
  const session = await auth();
  const logger = await getLogger("cancel");

  if (!session?.user.id) {
    const result: ReservationActionResult = {
      success: false,
      message: "キャンセルするにはログインしてください。",
    };

    logger.warn({ reservationId, result }, result.message);

    return result;
  }

  const parsed = idSchema.safeParse(reservationId);

  if (!parsed.success) {
    const result: ReservationActionResult = {
      success: false,
      message: "予約IDが正しくありません。",
    };

    logger.warn({ reservationId, result, err: parsed.error }, result.message);

    return result;
  }

  const reservationApplicationService = container.get(
    ReservationApplicationService,
  );

  try {
    const reservation = await reservationApplicationService.cancel(
      parsed.data,
      session.user.id,
    );

    revalidatePath(`/events/${reservation.eventId}`);

    const result: ReservationActionResult = {
      success: true,
      reservationId: null,
      message: "予約をキャンセルしました。",
    };

    logger.info({ reservationId, result }, result.message);

    return result;
  } catch (error) {
    if (!(error instanceof DomainError)) {
      throw error;
    }

    const result: ReservationActionResult = {
      success: false,
      message: error.message,
    };

    logger.warn({ reservationId, result, err: error }, result.message);

    return result;
  }
}
