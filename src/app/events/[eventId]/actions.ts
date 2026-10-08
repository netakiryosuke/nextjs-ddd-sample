"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EventNotFoundError } from "@/domain/event/EventNotFoundError";
import { ReservationApplicationService } from "@/application/ReservationApplicationService";
import { ReservationNotFoundError } from "@/domain/reservation/ReservationNotFoundError";
import { container } from "@/di/container";
import { EventCancellationNotAllowedError } from "@/domain/event/EventCancellationNotAllowedError";
import { EventNotReservableError } from "@/domain/event/EventNotReservableError";
import { DuplicateReservationError } from "@/domain/reservation/DuplicateReservationError";
import { ReservationAlreadyCancelledError } from "@/domain/reservation/ReservationAlreadyCancelledError";
import { ReservationOwnershipError } from "@/domain/reservation/ReservationOwnershipError";
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
    if (error instanceof EventNotFoundError) {
      const result: ReservationActionResult = {
        success: false,
        message: "催事が見つかりません。",
      };

      logger.warn({ eventId, result, err: error }, result.message);

      return result;
    }

    if (error instanceof DuplicateReservationError) {
      const result: ReservationActionResult = {
        success: false,
        message: "この催事はすでに予約しています。",
      };

      logger.warn({ eventId, result, err: error }, result.message);

      return result;
    }

    if (error instanceof EventNotReservableError) {
      const result: ReservationActionResult = {
        success: false,
        message: "満席、または開始時刻を過ぎたため予約できません。",
      };

      logger.warn({ eventId, result, err: error }, result.message);

      return result;
    }

    throw error;
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
    if (error instanceof ReservationNotFoundError) {
      const result: ReservationActionResult = {
        success: false,
        message: "予約が見つかりません。",
      };

      logger.warn({ reservationId, result, err: error }, result.message);

      return result;
    }

    if (error instanceof EventNotFoundError) {
      const result: ReservationActionResult = {
        success: false,
        message: "催事が見つかりません。",
      };

      logger.warn({ reservationId, result, err: error }, result.message);

      return result;
    }

    if (error instanceof ReservationOwnershipError) {
      const result: ReservationActionResult = {
        success: false,
        message: "ご本人の予約のみキャンセルできます。",
      };

      logger.warn({ reservationId, result, err: error }, result.message);

      return result;
    }

    if (error instanceof ReservationAlreadyCancelledError) {
      const result: ReservationActionResult = {
        success: false,
        message: "この予約はすでにキャンセルされています。",
      };

      logger.warn({ reservationId, result, err: error }, result.message);

      return result;
    }

    if (error instanceof EventCancellationNotAllowedError) {
      const result: ReservationActionResult = {
        success: false,
        message: "開始時刻を過ぎたためキャンセルできません。",
      };

      logger.warn({ reservationId, result, err: error }, result.message);

      return result;
    }

    throw error;
  }
}
