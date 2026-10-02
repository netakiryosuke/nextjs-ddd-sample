import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "../../tests/support/createTestDatabase";
import { Event } from "../domain/event/Event";
import { EventAvailability } from "../domain/event/EventAvailability";
import { EventPeriod } from "../domain/event/EventPeriod";
import { ReservationStatus } from "../domain/reservation/ReservationStatus";
import { Venue } from "../domain/venue/Venue";
import { EventAvailabilityDao } from "./dao/EventAvailabilityDao";
import { PrismaEventAvailabilityRepository } from "./PrismaEventAvailabilityRepository";

describe("PrismaEventAvailabilityRepository", () => {
  let testDatabase: Awaited<
    ReturnType<typeof createTestDatabase>
  >;
  let prismaEventAvailabilityRepository: PrismaEventAvailabilityRepository;

  before(async () => {
    testDatabase = await createTestDatabase();
    prismaEventAvailabilityRepository = new PrismaEventAvailabilityRepository(
      new EventAvailabilityDao(testDatabase.prismaClient),
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

  it("findByIdは催事と有効予約数を持つEntityを返す", async () => {
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
        "customer-3",
        ReservationStatus.CANCELLED,
        RESERVED_AT,
        CANCELLED_AT,
      ],
    );

    const eventAvailability =
      await prismaEventAvailabilityRepository.findById(EVENT_ID);
    assert.ok(eventAvailability instanceof EventAvailability);
    assert.ok(eventAvailability.event instanceof Event);
    assert.ok(eventAvailability.event.venue instanceof Venue);
    assert.ok(eventAvailability.event.period instanceof EventPeriod);
    assert.equal(eventAvailability.id, EVENT_ID);
    assert.equal(eventAvailability.event.venueName, VENUE_NAME);
    assert.equal(eventAvailability.reservationCount, 2);
  });

  it("findByIdは予約がなければ有効予約数ゼロのEntityを返す", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_NAME = "催事会場";
    const EVENT_TITLE = "陶芸ワークショップ";
    const CAPACITY = 3;
    const START_TIME = new Date("2026-10-10T10:00:00.123+09:00");
    const END_TIME = new Date("2026-10-10T11:00:00.123+09:00");

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, EVENT_TITLE, VENUE_ID, START_TIME, END_TIME, CAPACITY],
    );

    const eventAvailability =
      await prismaEventAvailabilityRepository.findById(EVENT_ID);
    assert.ok(eventAvailability instanceof EventAvailability);
    assert.equal(eventAvailability.reservationCount, 0);
  });

  it("findByIdはキャンセル済み予約を有効予約数に含めない", async () => {
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
        ReservationStatus.CANCELLED,
        RESERVED_AT,
        CANCELLED_AT,
      ],
    );

    const eventAvailability =
      await prismaEventAvailabilityRepository.findById(EVENT_ID);
    assert.ok(eventAvailability instanceof EventAvailability);
    assert.equal(eventAvailability.reservationCount, 0);
  });

  it("findByIdは存在しないIDならnullを返す", async () => {
    assert.equal(
      await prismaEventAvailabilityRepository.findById(randomUUID()),
      null,
    );
  });

  it("findAllは催事ごとの有効予約数を持つEntity一覧を返す", async () => {
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
        otherEventId,
        USER_ID,
        ReservationStatus.CANCELLED,
        RESERVED_AT,
        CANCELLED_AT,
      ],
    );

    const eventAvailabilities =
      await prismaEventAvailabilityRepository.findAll();
    assert.equal(eventAvailabilities.length, 2);
    assert.ok(
      eventAvailabilities.every(
        (eventAvailability) => eventAvailability instanceof EventAvailability,
      ),
    );

    assert.equal(
      eventAvailabilities.find(
        (eventAvailability) => eventAvailability.id === EVENT_ID,
      )?.reservationCount,
      1,
    );

    assert.equal(
      eventAvailabilities.find(
        (eventAvailability) => eventAvailability.id === otherEventId,
      )?.reservationCount,
      0,
    );
  });
});
