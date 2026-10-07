import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { Event } from "../domain/event/Event";
import { EventAvailability } from "../domain/event/EventAvailability";
import type { EventAvailabilityRepository } from "../domain/event/EventAvailabilityRepository";
import type { EventRepository } from "../domain/event/EventRepository";
import { EventPeriod } from "../domain/event/EventPeriod";
import { EventNotReservableError } from "../domain/event/EventNotReservableError";
import { EventCancellationNotAllowedError } from "../domain/event/EventCancellationNotAllowedError";
import { Venue } from "../domain/venue/Venue";
import { Reservation } from "../domain/reservation/Reservation";
import { ReservationStatus } from "../domain/reservation/ReservationStatus";
import { DuplicateReservationError } from "../domain/reservation/DuplicateReservationError";
import { ReservationOwnershipError } from "../domain/reservation/ReservationOwnershipError";
import { ReservationAlreadyCancelledError } from "../domain/reservation/ReservationAlreadyCancelledError";
import type { ReservationRepository } from "../domain/reservation/ReservationRepository";
import { EventNotFoundError } from "../domain/event/EventNotFoundError";
import { ReservationNotFoundError } from "../domain/reservation/ReservationNotFoundError";
import { ReservationApplicationService } from "./ReservationApplicationService";
import type { TransactionManager } from "./TransactionManager";

function unexpectedRepositoryCall(): never {
  assert.fail("Unexpected repository call");
}

describe("ReservationApplicationService", () => {
  for (const {
    name,
    reservationCount,
    advanceTime,
    hasReservation,
    exists,
    now,
    expectedError,
  } of [
    {
      name: "空席があれば予約し、保存後のEntityを返す",
      reservationCount: 0,
      advanceTime: 0,
      hasReservation: false,
      exists: true,
      now: "2026-10-10T09:59:59.999+09:00",
      expectedError: null,
    },
    {
      name: "満席では保存しない",
      reservationCount: 3,
      advanceTime: 0,
      hasReservation: false,
      exists: true,
      now: "2026-10-10T09:00:00+09:00",
      expectedError: EventNotReservableError,
    },
    {
      name: "開始時刻ちょうどでは保存しない",
      reservationCount: 0,
      advanceTime: 0,
      hasReservation: false,
      exists: true,
      now: "2026-10-10T10:00:00+09:00",
      expectedError: EventNotReservableError,
    },
    {
      name: "本人の有効な予約があれば保存しない",
      reservationCount: 1,
      advanceTime: 0,
      hasReservation: true,
      exists: true,
      now: "2026-10-10T09:00:00+09:00",
      expectedError: DuplicateReservationError,
    },
    {
      name: "催事が存在しなければ保存しない",
      reservationCount: 0,
      advanceTime: 0,
      hasReservation: false,
      exists: false,
      now: "2026-10-10T09:00:00+09:00",
      expectedError: EventNotFoundError,
    },
    {
      name: "満席でも本人の有効な予約があれば重複予約として拒否する",
      reservationCount: 3,
      advanceTime: 0,
      hasReservation: true,
      exists: true,
      now: "2026-10-10T09:00:00+09:00",
      expectedError: DuplicateReservationError,
    },
    {
      name: "重複予約の検索中に開始時刻になった場合も保存しない",
      reservationCount: 0,
      advanceTime: 1,
      hasReservation: false,
      exists: true,
      now: "2026-10-10T09:59:59.999+09:00",
      expectedError: EventNotReservableError,
    },
  ]) {
    it(`reserveは${name}`, async (context) => {
      context.mock.timers.enable({ apis: ["Date"], now: new Date(now) });
      const event = new Event(
        "11111111-1111-4111-8111-111111111111",
        "陶芸ワークショップ",
        new Venue("22222222-2222-4222-8222-222222222222", "催事会場"),
        new EventPeriod(
          new Date("2026-10-10T10:00:00+09:00"),
          new Date("2026-10-10T11:00:00+09:00"),
        ),
        3,
      );
      let savedReservation: Reservation | undefined;
      const save = mock.fn(async (reservation: Reservation) => {
        savedReservation = new Reservation(
          reservation.id,
          reservation.eventId,
          reservation.userId,
          reservation.status,
          reservation.reservedAt,
          reservation.cancelledAt,
        );
        return savedReservation;
      });
      const existsByEventIdAndUserIdAndStatus = mock.fn(async () => {
        context.mock.timers.tick(advanceTime);
        return hasReservation;
      });
      let locked = false;
      const eventRepository: EventRepository = {
        findById: unexpectedRepositoryCall,
        findByIdForUpdate: async (eventId) => {
          assert.equal(eventId, event.id);
          locked = true;
          return exists ? event : null;
        },
        findAll: unexpectedRepositoryCall,
        save: unexpectedRepositoryCall,
      };
      const eventAvailabilityRepository: EventAvailabilityRepository = {
        findById: async () => {
          assert.equal(locked, true);
          return exists ? new EventAvailability(event, reservationCount) : null;
        },
        findAll: unexpectedRepositoryCall,
      };
      const reservationRepository: ReservationRepository = {
        findById: unexpectedRepositoryCall,
        findByEventIdAndUserIdAndStatus: unexpectedRepositoryCall,
        existsByEventIdAndUserIdAndStatus,
        countByEventIdAndStatus: unexpectedRepositoryCall,
        save,
      };
      const transactionManager: TransactionManager = {
        async execute(operation) {
          return operation();
        },
      };
      const reservationApplicationService = new ReservationApplicationService(
        eventRepository,
        eventAvailabilityRepository,
        reservationRepository,
        transactionManager,
      );

      if (expectedError !== null) {
        await assert.rejects(
          () => reservationApplicationService.reserve(event.id, "customer-1"),
          expectedError,
        );
        assert.equal(save.mock.callCount(), 0);
      } else {
        const reservation = await reservationApplicationService.reserve(
          event.id,
          "customer-1",
        );

        assert.ok(reservation instanceof Reservation);
        assert.equal(reservation, savedReservation);
        assert.match(
          reservation.id,
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        assert.equal(reservation.eventId, event.id);
        assert.equal(reservation.userId, "customer-1");
        assert.equal(reservation.status, ReservationStatus.RESERVED);
        assert.equal(
          reservation.reservedAt.toISOString(),
          new Date(now).toISOString(),
        );
        assert.equal(reservation.cancelledAt, null);
        assert.equal(save.mock.callCount(), 1);
      }

      if (exists) {
        assert.deepEqual(
          existsByEventIdAndUserIdAndStatus.mock.calls[0].arguments,
          [event.id, "customer-1", ReservationStatus.RESERVED],
        );
      }
    });
  }

  for (const {
    name,
    userId,
    cancelled,
    reservationExists,
    currentReservationExists,
    eventExists,
    now,
    expectedError,
  } of [
    {
      name: "本人が開始直前にキャンセルできる",
      userId: "customer-1",
      cancelled: false,
      reservationExists: true,
      currentReservationExists: true,
      eventExists: true,
      now: "2026-10-10T09:59:59.999+09:00",
      expectedError: null,
    },
    {
      name: "他人の操作を拒否する",
      userId: "customer-2",
      cancelled: false,
      reservationExists: true,
      currentReservationExists: true,
      eventExists: true,
      now: "2026-10-10T09:00:00+09:00",
      expectedError: ReservationOwnershipError,
    },
    {
      name: "ロック後に再取得したキャンセル済み状態で判断する",
      userId: "customer-1",
      cancelled: true,
      reservationExists: true,
      currentReservationExists: true,
      eventExists: true,
      now: "2026-10-10T09:00:00+09:00",
      expectedError: ReservationAlreadyCancelledError,
    },
    {
      name: "開始時刻ちょうどの操作を拒否する",
      userId: "customer-1",
      cancelled: false,
      reservationExists: true,
      currentReservationExists: true,
      eventExists: true,
      now: "2026-10-10T10:00:00+09:00",
      expectedError: EventCancellationNotAllowedError,
    },
    {
      name: "存在しない予約を拒否する",
      userId: "customer-1",
      cancelled: false,
      reservationExists: false,
      currentReservationExists: false,
      eventExists: true,
      now: "2026-10-10T09:00:00+09:00",
      expectedError: ReservationNotFoundError,
    },
    {
      name: "ロック後に予約がなければ拒否する",
      userId: "customer-1",
      cancelled: false,
      reservationExists: true,
      currentReservationExists: false,
      eventExists: true,
      now: "2026-10-10T09:00:00+09:00",
      expectedError: ReservationNotFoundError,
    },
    {
      name: "催事が存在しなければ拒否する",
      userId: "customer-1",
      cancelled: false,
      reservationExists: true,
      currentReservationExists: true,
      eventExists: false,
      now: "2026-10-10T09:00:00+09:00",
      expectedError: EventNotFoundError,
    },
  ]) {
    it(`cancelは${name}`, async (context) => {
      context.mock.timers.enable({ apis: ["Date"], now: new Date(now) });
      const event = new Event(
        "11111111-1111-4111-8111-111111111111",
        "陶芸ワークショップ",
        new Venue("22222222-2222-4222-8222-222222222222", "催事会場"),
        new EventPeriod(
          new Date("2026-10-10T10:00:00+09:00"),
          new Date("2026-10-10T11:00:00+09:00"),
        ),
        1,
      );
      const reservation = new Reservation(
        "33333333-3333-4333-8333-333333333333",
        event.id,
        "customer-1",
        ReservationStatus.RESERVED,
        new Date("2026-10-01T10:00:00+09:00"),
        null,
      );
      const currentReservation = new Reservation(
        reservation.id,
        event.id,
        reservation.userId,
        cancelled ? ReservationStatus.CANCELLED : ReservationStatus.RESERVED,
        reservation.reservedAt,
        cancelled ? new Date("2026-10-02T10:00:00+09:00") : null,
      );
      const save = mock.fn(async (reservation: Reservation) => reservation);
      let locked = false;
      const findById = mock.fn(async () => {
        if (!locked) {
          return reservationExists ? reservation : null;
        }
        return currentReservationExists ? currentReservation : null;
      });
      let transactionExecuted = false;
      const eventRepository: EventRepository = {
        findById: unexpectedRepositoryCall,
        findByIdForUpdate: async (eventId) => {
          assert.equal(transactionExecuted, true);
          assert.equal(eventId, event.id);
          locked = true;
          return eventExists ? event : null;
        },
        findAll: unexpectedRepositoryCall,
        save: unexpectedRepositoryCall,
      };
      const eventAvailabilityRepository: EventAvailabilityRepository = {
        findById: unexpectedRepositoryCall,
        findAll: unexpectedRepositoryCall,
      };
      const reservationRepository: ReservationRepository = {
        findById,
        findByEventIdAndUserIdAndStatus: unexpectedRepositoryCall,
        existsByEventIdAndUserIdAndStatus: unexpectedRepositoryCall,
        countByEventIdAndStatus: unexpectedRepositoryCall,
        save,
      };
      const transactionManager: TransactionManager = {
        async execute(operation) {
          transactionExecuted = true;
          return operation();
        },
      };
      const reservationApplicationService = new ReservationApplicationService(
        eventRepository,
        eventAvailabilityRepository,
        reservationRepository,
        transactionManager,
      );

      if (expectedError !== null) {
        await assert.rejects(
          () => reservationApplicationService.cancel(reservation.id, userId),
          expectedError,
        );
        assert.equal(save.mock.callCount(), 0);
      } else {
        const cancelledReservation = await reservationApplicationService.cancel(
          reservation.id,
          userId,
        );

        assert.notEqual(cancelledReservation, currentReservation);
        assert.equal(cancelledReservation.id, currentReservation.id);
        assert.equal(cancelledReservation.eventId, currentReservation.eventId);
        assert.equal(cancelledReservation.userId, currentReservation.userId);
        assert.equal(cancelledReservation.status, ReservationStatus.CANCELLED);
        assert.equal(
          cancelledReservation.cancelledAt?.toISOString(),
          new Date(now).toISOString(),
        );
        assert.equal(
          cancelledReservation.reservedAt.toISOString(),
          reservation.reservedAt.toISOString(),
        );
        assert.equal(save.mock.callCount(), 1);
        assert.equal(save.mock.calls[0].arguments[0], cancelledReservation);
        assert.equal(currentReservation.status, ReservationStatus.RESERVED);
        assert.equal(currentReservation.cancelledAt, null);
      }

      assert.equal(transactionExecuted, reservationExists);
      if (reservationExists) {
        assert.deepEqual(findById.mock.calls[0].arguments, [reservation.id]);
      }
      assert.equal(reservation.status, ReservationStatus.RESERVED);
    });
  }
});
