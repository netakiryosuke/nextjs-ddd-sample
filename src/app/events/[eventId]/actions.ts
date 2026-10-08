"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { EventNotFoundError } from "@/domain/event/EventNotFoundError";
import { ReservationApplicationService } from "@/application/ReservationApplicationService";
import { ReservationNotFoundError } from "@/domain/reservation/ReservationNotFoundError";
import { container } from "@/di/container";
import { EventCancellationNotAllowedError } from "@/domain/event/EventCancellationNotAllowedError";
import { EventNotReservableError } from "@/domain/event/EventNotReservableError";
import { DuplicateReservationError } from "@/domain/reservation/DuplicateReservationError";
import { ReservationAlreadyCancelledError } from "@/domain/reservation/ReservationAlreadyCancelledError";
import { ReservationOwnershipError } from "@/domain/reservation/ReservationOwnershipError";

const idSchema = z.uuid();

export type ReservationActionResult =
  | { success: true; reservationId: string | null; message: string }
  | { success: false; message: string };

export async function reserveAction(
  eventId: string,
): Promise<ReservationActionResult> {
  const session = await auth();

  if (!session?.user.id) {
    return { success: false, message: "予約するにはログインしてください。" };
  }

  const parsed = idSchema.safeParse(eventId);

  if (!parsed.success) {
    return { success: false, message: "催事IDが正しくありません。" };
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

    return {
      success: true,
      reservationId: reservation.id,
      message: "予約が完了しました。",
    };
  } catch (error) {
    if (error instanceof EventNotFoundError) {
      return { success: false, message: "催事が見つかりません。" };
    }

    if (error instanceof DuplicateReservationError) {
      return { success: false, message: "この催事はすでに予約しています。" };
    }

    if (error instanceof EventNotReservableError) {
      return {
        success: false,
        message: "満席、または開始時刻を過ぎたため予約できません。",
      };
    }

    throw error;
  }
}

export async function cancelAction(
  reservationId: string,
): Promise<ReservationActionResult> {
  const session = await auth();

  if (!session?.user.id) {
    return { success: false, message: "キャンセルするにはログインしてください。" };
  }

  const parsed = idSchema.safeParse(reservationId);

  if (!parsed.success) {
    return { success: false, message: "予約IDが正しくありません。" };
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

    return {
      success: true,
      reservationId: null,
      message: "予約をキャンセルしました。",
    };
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      return { success: false, message: "予約が見つかりません。" };
    }

    if (error instanceof EventNotFoundError) {
      return { success: false, message: "催事が見つかりません。" };
    }

    if (error instanceof ReservationOwnershipError) {
      return { success: false, message: "ご本人の予約のみキャンセルできます。" };
    }

    if (error instanceof ReservationAlreadyCancelledError) {
      return { success: false, message: "この予約はすでにキャンセルされています。" };
    }

    if (error instanceof EventCancellationNotAllowedError) {
      return { success: false, message: "開始時刻を過ぎたためキャンセルできません。" };
    }

    throw error;
  }
}
