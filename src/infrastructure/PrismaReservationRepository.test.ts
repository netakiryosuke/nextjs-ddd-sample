import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  createRepositoryTestDatabase,
  EVENT_ID,
  USER_ID,
  RESERVED_AT,
  CANCELLED_AT,
} from "../../tests/support/createRepositoryTestDatabase";
import { Reservation } from "../domain/reservation/Reservation";
import { ReservationStatus } from "../domain/reservation/ReservationStatus";
import { PrismaReservationRepository } from "./PrismaReservationRepository";

describe("PrismaReservationRepository", () => {
  let repositoryTestDatabase: Awaited<
    ReturnType<typeof createRepositoryTestDatabase>
  >;
  let prismaReservationRepository: PrismaReservationRepository;

  before(async () => {
    repositoryTestDatabase = await createRepositoryTestDatabase();
    prismaReservationRepository = new PrismaReservationRepository(
      repositoryTestDatabase.prismaClient,
    );
  });

  beforeEach(async () => {
    await repositoryTestDatabase.reset();
  });

  after(async () => {
    await repositoryTestDatabase?.close();
  });

  it("findByIdは予約状態と日時を持つEntityを返す", async () => {
    const reservationId = await repositoryTestDatabase.insertReservation(
      EVENT_ID,
      USER_ID,
      ReservationStatus.CANCELLED,
    );
    const reservation =
      await prismaReservationRepository.findById(reservationId);
    assert.ok(reservation instanceof Reservation);
    assert.equal(reservation.id, reservationId);
    assert.equal(reservation.eventId, EVENT_ID);
    assert.equal(reservation.userId, USER_ID);
    assert.equal(reservation.status, ReservationStatus.CANCELLED);
    assert.equal(reservation.reservedAt.getTime(), RESERVED_AT.getTime());
    assert.equal(reservation.cancelledAt?.getTime(), CANCELLED_AT.getTime());
  });

  it("findByIdは存在しないIDならnullを返す", async () => {
    assert.equal(
      await prismaReservationRepository.findById(randomUUID()),
      null,
    );
  });

  it("findByEventIdAndUserIdAndStatusは全条件に一致するEntity一覧を返す", async () => {
    const reservationIds = [
      await repositoryTestDatabase.insertReservation(
        EVENT_ID,
        USER_ID,
        ReservationStatus.CANCELLED,
      ),
      await repositoryTestDatabase.insertReservation(
        EVENT_ID,
        USER_ID,
        ReservationStatus.CANCELLED,
      ),
    ];
    await repositoryTestDatabase.insertReservation();
    await repositoryTestDatabase.insertReservation(
      EVENT_ID,
      "customer-2",
      ReservationStatus.CANCELLED,
    );
    const otherEventId = randomUUID();
    await repositoryTestDatabase.insertEvent(otherEventId);
    await repositoryTestDatabase.insertReservation(
      otherEventId,
      USER_ID,
      ReservationStatus.CANCELLED,
    );
    const reservations =
      await prismaReservationRepository.findByEventIdAndUserIdAndStatus(
        EVENT_ID,
        USER_ID,
        ReservationStatus.CANCELLED,
      );
    assert.deepEqual(
      reservations.map((reservation) => reservation.id).sort(),
      reservationIds.sort(),
    );
    assert.ok(
      reservations.every((reservation) => reservation instanceof Reservation),
    );
  });

  it("findByEventIdAndUserIdAndStatusは該当なしなら空配列を返す", async () => {
    assert.deepEqual(
      await prismaReservationRepository.findByEventIdAndUserIdAndStatus(
        EVENT_ID,
        USER_ID,
        ReservationStatus.RESERVED,
      ),
      [],
    );
  });

  it("existsByEventIdAndUserIdAndStatusは全条件に一致する予約の有無を返す", async () => {
    await repositoryTestDatabase.insertReservation();
    assert.equal(
      await prismaReservationRepository.existsByEventIdAndUserIdAndStatus(
        EVENT_ID,
        USER_ID,
        ReservationStatus.RESERVED,
      ),
      true,
    );
    for (const [eventId, userId, reservationStatus] of [
      [EVENT_ID, USER_ID, ReservationStatus.CANCELLED],
      [EVENT_ID, "other-user", ReservationStatus.RESERVED],
      [randomUUID(), USER_ID, ReservationStatus.RESERVED],
    ] as const) {
      assert.equal(
        await prismaReservationRepository.existsByEventIdAndUserIdAndStatus(
          eventId,
          userId,
          reservationStatus,
        ),
        false,
      );
    }
  });

  it("countByEventIdAndStatusは催事と状態が一致する予約の件数を返す", async () => {
    await repositoryTestDatabase.insertReservation();
    await repositoryTestDatabase.insertReservation(EVENT_ID, "customer-2");
    await repositoryTestDatabase.insertReservation(
      EVENT_ID,
      USER_ID,
      ReservationStatus.CANCELLED,
    );
    const otherEventId = randomUUID();
    await repositoryTestDatabase.insertEvent(otherEventId);
    await repositoryTestDatabase.insertReservation(otherEventId);
    for (const [eventId, reservationStatus, expectedCount] of [
      [EVENT_ID, ReservationStatus.RESERVED, 2],
      [EVENT_ID, ReservationStatus.CANCELLED, 1],
      [randomUUID(), ReservationStatus.RESERVED, 0],
    ] as const) {
      assert.equal(
        await prismaReservationRepository.countByEventIdAndStatus(
          eventId,
          reservationStatus,
        ),
        expectedCount,
      );
    }
  });

  it("saveは予約を新規保存しEntityを返す", async () => {
    const reservationId = randomUUID();
    const reservation = await prismaReservationRepository.save(
      Reservation.create(reservationId, EVENT_ID, USER_ID, RESERVED_AT),
    );
    assert.ok(reservation instanceof Reservation);
    assert.equal(reservation.id, reservationId);
    assert.equal(reservation.status, ReservationStatus.RESERVED);
    assert.equal(reservation.cancelledAt, null);
    assert.deepEqual(
      await prismaReservationRepository.findById(reservationId),
      reservation,
    );
  });

  it("saveは既存の予約状態と日時を更新しEntityを返す", async () => {
    const reservationId = await repositoryTestDatabase.insertReservation();
    const reservation = Reservation.reconstruct(
      reservationId,
      EVENT_ID,
      USER_ID,
      ReservationStatus.CANCELLED,
      RESERVED_AT,
      CANCELLED_AT,
    );
    const savedReservation =
      await prismaReservationRepository.save(reservation);
    assert.ok(savedReservation instanceof Reservation);
    assert.equal(savedReservation.status, ReservationStatus.CANCELLED);
    assert.equal(
      savedReservation.cancelledAt?.getTime(),
      CANCELLED_AT.getTime(),
    );
    assert.deepEqual(
      await prismaReservationRepository.findById(reservationId),
      savedReservation,
    );
    assert.equal(
      await prismaReservationRepository.countByEventIdAndStatus(
        EVENT_ID,
        ReservationStatus.CANCELLED,
      ),
      1,
    );
  });
});
