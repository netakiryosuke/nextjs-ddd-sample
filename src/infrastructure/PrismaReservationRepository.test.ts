import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "../../tests/support/createTestDatabase";
import { Reservation } from "../domain/reservation/Reservation";
import { ReservationStatus } from "../domain/reservation/ReservationStatus";
import { PrismaReservationRepository } from "./PrismaReservationRepository";

describe("PrismaReservationRepository", () => {
  let testDatabase: Awaited<
    ReturnType<typeof createTestDatabase>
  >;
  let prismaReservationRepository: PrismaReservationRepository;

  before(async () => {
    testDatabase = await createTestDatabase();
    prismaReservationRepository = new PrismaReservationRepository(
      testDatabase.prismaClient,
    );
  });

  beforeEach(async () => {
    await testDatabase.client.query(
      "TRUNCATE reservations, events, venues",
    );
  });

  after(async () => {
    await testDatabase?.close();
  });

  it("findByIdは予約状態と日時を持つEntityを返す", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_NAME = "催事会場";
    const EVENT_TITLE = "陶芸ワークショップ";
    const USER_ID = "customer-1";
    const CAPACITY = 3;
    const START_TIME = new Date("2026-10-10T10:00:00.123+09:00");
    const END_TIME = new Date("2026-10-10T11:00:00.123+09:00");
    const RESERVED_AT = new Date("2026-10-01T10:00:00.123+09:00");
    const CANCELLED_AT = new Date("2026-10-02T10:00:00.123+09:00");

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, EVENT_TITLE, VENUE_ID, START_TIME, END_TIME, CAPACITY],
    );

    const reservationId = randomUUID();
    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        reservationId,
        EVENT_ID,
        USER_ID,
        ReservationStatus.CANCELLED,
        RESERVED_AT,
        CANCELLED_AT,
      ],
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
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_NAME = "催事会場";
    const EVENT_TITLE = "陶芸ワークショップ";
    const USER_ID = "customer-1";
    const CAPACITY = 3;
    const START_TIME = new Date("2026-10-10T10:00:00.123+09:00");
    const END_TIME = new Date("2026-10-10T11:00:00.123+09:00");
    const RESERVED_AT = new Date("2026-10-01T10:00:00.123+09:00");
    const CANCELLED_AT = new Date("2026-10-02T10:00:00.123+09:00");

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, EVENT_TITLE, VENUE_ID, START_TIME, END_TIME, CAPACITY],
    );

    const reservationIds = [randomUUID(), randomUUID()];
    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        reservationIds[0],
        EVENT_ID,
        USER_ID,
        ReservationStatus.CANCELLED,
        RESERVED_AT,
        CANCELLED_AT,
      ],
    );
    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        reservationIds[1],
        EVENT_ID,
        USER_ID,
        ReservationStatus.CANCELLED,
        RESERVED_AT,
        CANCELLED_AT,
      ],
    );
    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        EVENT_ID,
        USER_ID,
        ReservationStatus.RESERVED,
        RESERVED_AT,
        null,
      ],
    );
    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        EVENT_ID,
        "customer-2",
        ReservationStatus.CANCELLED,
        RESERVED_AT,
        CANCELLED_AT,
      ],
    );

    const otherEventId = randomUUID();
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [otherEventId, EVENT_TITLE, VENUE_ID, START_TIME, END_TIME, CAPACITY],
    );
    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        otherEventId,
        USER_ID,
        ReservationStatus.CANCELLED,
        RESERVED_AT,
        CANCELLED_AT,
      ],
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
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const USER_ID = "customer-1";

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
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_NAME = "催事会場";
    const EVENT_TITLE = "陶芸ワークショップ";
    const USER_ID = "customer-1";
    const CAPACITY = 3;
    const START_TIME = new Date("2026-10-10T10:00:00.123+09:00");
    const END_TIME = new Date("2026-10-10T11:00:00.123+09:00");
    const RESERVED_AT = new Date("2026-10-01T10:00:00.123+09:00");

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, EVENT_TITLE, VENUE_ID, START_TIME, END_TIME, CAPACITY],
    );

    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        EVENT_ID,
        USER_ID,
        ReservationStatus.RESERVED,
        RESERVED_AT,
        null,
      ],
    );

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
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_NAME = "催事会場";
    const EVENT_TITLE = "陶芸ワークショップ";
    const USER_ID = "customer-1";
    const CAPACITY = 3;
    const START_TIME = new Date("2026-10-10T10:00:00.123+09:00");
    const END_TIME = new Date("2026-10-10T11:00:00.123+09:00");
    const RESERVED_AT = new Date("2026-10-01T10:00:00.123+09:00");
    const CANCELLED_AT = new Date("2026-10-02T10:00:00.123+09:00");

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, EVENT_TITLE, VENUE_ID, START_TIME, END_TIME, CAPACITY],
    );

    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        EVENT_ID,
        USER_ID,
        ReservationStatus.RESERVED,
        RESERVED_AT,
        null,
      ],
    );
    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        EVENT_ID,
        "customer-2",
        ReservationStatus.RESERVED,
        RESERVED_AT,
        null,
      ],
    );
    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        EVENT_ID,
        USER_ID,
        ReservationStatus.CANCELLED,
        RESERVED_AT,
        CANCELLED_AT,
      ],
    );

    const otherEventId = randomUUID();
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [otherEventId, EVENT_TITLE, VENUE_ID, START_TIME, END_TIME, CAPACITY],
    );
    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        otherEventId,
        USER_ID,
        ReservationStatus.RESERVED,
        RESERVED_AT,
        null,
      ],
    );
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
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_NAME = "催事会場";
    const EVENT_TITLE = "陶芸ワークショップ";
    const USER_ID = "customer-1";
    const CAPACITY = 3;
    const START_TIME = new Date("2026-10-10T10:00:00.123+09:00");
    const END_TIME = new Date("2026-10-10T11:00:00.123+09:00");
    const RESERVED_AT = new Date("2026-10-01T10:00:00.123+09:00");

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, EVENT_TITLE, VENUE_ID, START_TIME, END_TIME, CAPACITY],
    );

    const reservationId = randomUUID();
    const reservation = await prismaReservationRepository.save(
      new Reservation(
        reservationId,
        EVENT_ID,
        USER_ID,
        ReservationStatus.RESERVED,
        RESERVED_AT,
        null,
      ),
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
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_NAME = "催事会場";
    const EVENT_TITLE = "陶芸ワークショップ";
    const USER_ID = "customer-1";
    const CAPACITY = 3;
    const START_TIME = new Date("2026-10-10T10:00:00.123+09:00");
    const END_TIME = new Date("2026-10-10T11:00:00.123+09:00");
    const RESERVED_AT = new Date("2026-10-01T10:00:00.123+09:00");
    const CANCELLED_AT = new Date("2026-10-02T10:00:00.123+09:00");

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, EVENT_TITLE, VENUE_ID, START_TIME, END_TIME, CAPACITY],
    );

    const reservationId = randomUUID();
    await testDatabase.client.query(
      `INSERT INTO reservations
       (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        reservationId,
        EVENT_ID,
        USER_ID,
        ReservationStatus.RESERVED,
        RESERVED_AT,
        null,
      ],
    );

    const reservation = new Reservation(
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
