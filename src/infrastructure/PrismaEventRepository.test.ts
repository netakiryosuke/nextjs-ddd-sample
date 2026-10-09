import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "../../tests/support/createTestDatabase";
import { Event } from "../domain/event/Event";
import { EventPeriod } from "../domain/event/EventPeriod";
import { Venue } from "../domain/venue/Venue";
import { EventDao } from "./dao/EventDao";
import { PrismaEventRepository } from "./PrismaEventRepository";

describe("PrismaEventRepository", () => {
  let testDatabase: Awaited<
    ReturnType<typeof createTestDatabase>
  >;
  let prismaEventRepository: PrismaEventRepository;

  before(async () => {
    testDatabase = await createTestDatabase();
    prismaEventRepository = new PrismaEventRepository(
      testDatabase.prismaClient,
      new EventDao(testDatabase.prismaClient),
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

  it("findByIdは会場と開催期間を持つ催事のEntityを返す", async () => {
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

    const event = await prismaEventRepository.findById(EVENT_ID);
    assert.ok(event instanceof Event);
    assert.ok(event.venue instanceof Venue);
    assert.ok(event.period instanceof EventPeriod);
    assert.equal(event.id, EVENT_ID);
    assert.equal(event.title, EVENT_TITLE);
    assert.equal(event.venueId, VENUE_ID);
    assert.equal(event.venueName, VENUE_NAME);
    assert.equal(event.period.startTime.getTime(), START_TIME.getTime());
    assert.equal(event.period.endTime.getTime(), END_TIME.getTime());
    assert.equal(event.capacity, CAPACITY);
  });

  it("findByIdは存在しないIDならnullを返す", async () => {
    assert.equal(await prismaEventRepository.findById(randomUUID()), null);
  });

  it("findAllは各催事の会場を含むEntity一覧を返す", async () => {
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

    const otherVenueId = randomUUID();
    const otherEventId = randomUUID();
    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [otherVenueId, "別会場"],
    );
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [otherEventId, EVENT_TITLE, otherVenueId, START_TIME, END_TIME, CAPACITY],
    );

    const events = await prismaEventRepository.findAll();
    assert.equal(events.length, 2);
    assert.ok(events.every((event) => event instanceof Event));
    assert.equal(
      events.find((event) => event.id === EVENT_ID)?.venueName,
      VENUE_NAME,
    );

    assert.equal(
      events.find((event) => event.id === otherEventId)?.venueName,
      "別会場",
    );
  });

  it("saveは採番前の催事にUUIDを付与し、元のEntityを変更せずに保存する", async () => {
    const venueId = "22222222-2222-4222-8222-222222222222";
    const venueName = "催事会場";

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [venueId, venueName],
    );

    const newEvent = new Event(
      null,
      "北海道の味覚展",
      new Venue(venueId, venueName),
      new EventPeriod(
        new Date("2027-01-10T10:00:00+09:00"),
        new Date("2027-01-10T11:00:00+09:00"),
      ),
      10,
    );

    const event = await prismaEventRepository.save(newEvent);

    assert.ok(event instanceof Event);
    assert.ok(event.id);
    assert.match(event.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(newEvent.id, null);
    assert.notStrictEqual(event, newEvent);
    assert.deepEqual(await prismaEventRepository.findById(event.id), event);
  });

  it("saveは催事を新規保存しEntityを返す", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const VENUE_NAME = "催事会場";
    const CAPACITY = 3;
    const START_TIME = new Date("2026-10-10T10:00:00.123+09:00");
    const END_TIME = new Date("2026-10-10T11:00:00.123+09:00");

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );

    const eventId = randomUUID();
    const event = await prismaEventRepository.save(
      new Event(
        eventId,
        "新しい催事",
        new Venue(VENUE_ID, VENUE_NAME),
        new EventPeriod(START_TIME, END_TIME),
        CAPACITY,
      ),
    );

    assert.ok(event instanceof Event);
    assert.ok(event.venue instanceof Venue);
    assert.ok(event.period instanceof EventPeriod);
    assert.equal(event.id, eventId);
    assert.equal(event.title, "新しい催事");
    assert.deepEqual(await prismaEventRepository.findById(eventId), event);
  });

  it("saveは既存の催事を更新し、会場名を上書きせずにEntityを返す", async () => {
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

    const event = await prismaEventRepository.save(
      new Event(
        EVENT_ID,
        "変更後の催事",
        new Venue(VENUE_ID, "保存対象ではない会場名"),
        new EventPeriod(START_TIME, END_TIME),
        CAPACITY + 1,
      ),
    );

    assert.ok(event instanceof Event);
    assert.equal(event.title, "変更後の催事");
    assert.equal(event.capacity, CAPACITY + 1);
    assert.equal(event.venueName, VENUE_NAME);
    assert.deepEqual(await prismaEventRepository.findById(EVENT_ID), event);
    assert.equal((await prismaEventRepository.findAll()).length, 1);
  });
  it("findByIdForUpdateは催事だけをロックし、会場を含むEntityを返す", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const START_TIME = new Date("2099-10-10T10:00:00+09:00");
    const END_TIME = new Date("2099-10-10T11:00:00+09:00");
    const CAPACITY = 3;
    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, "催事会場"],
    );
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        EVENT_ID,
        "陶芸ワークショップ",
        VENUE_ID,
        START_TIME,
        END_TIME,
        CAPACITY,
      ],
    );

    const event = await testDatabase.prismaClient.$transaction(
      async (transaction) => {
        const eventRepository = new PrismaEventRepository(
          transaction,
          new EventDao(transaction),
        );
        const lockedEvent = await eventRepository.findByIdForUpdate(EVENT_ID);

        await testDatabase.client.query("BEGIN");
        try {
          await assert.rejects(
            () =>
              testDatabase.client.query(
                "SELECT id FROM events WHERE id = $1 FOR UPDATE NOWAIT",
                [EVENT_ID],
              ),
            (error) =>
              error instanceof Error &&
              "code" in error &&
              error.code === "55P03",
          );
        } finally {
          await testDatabase.client.query("ROLLBACK");
        }

        await testDatabase.client.query("BEGIN");
        try {
          const venueRecords = await testDatabase.client.query(
            "SELECT id FROM venues WHERE id = $1 FOR UPDATE NOWAIT",
            [VENUE_ID],
          );
          assert.equal(venueRecords.rowCount, 1);
        } finally {
          await testDatabase.client.query("ROLLBACK");
        }

        return lockedEvent;
      },
    );

    assert.ok(event instanceof Event);
    assert.ok(event.venue instanceof Venue);
    assert.ok(event.period instanceof EventPeriod);
    assert.equal(event.id, EVENT_ID);
    assert.equal(event.title, "陶芸ワークショップ");
    assert.equal(event.venueId, VENUE_ID);
    assert.equal(event.venueName, "催事会場");
    assert.equal(
      event.period.startTime.toISOString(),
      START_TIME.toISOString(),
    );
    assert.equal(event.period.endTime.toISOString(), END_TIME.toISOString());
    assert.equal(event.capacity, CAPACITY);
    const eventRecords = await testDatabase.client.query(
      "SELECT id FROM events WHERE id = $1 FOR UPDATE NOWAIT",
      [EVENT_ID],
    );
    assert.equal(eventRecords.rowCount, 1);
  });

  it("findByIdForUpdateは存在しない催事ならnullを返す", async () => {
    const event = await testDatabase.prismaClient.$transaction(
      async (transaction) => {
        const eventRepository = new PrismaEventRepository(
          transaction,
          new EventDao(transaction),
        );
        return eventRepository.findByIdForUpdate(
          "11111111-1111-4111-8111-111111111111",
        );
      },
    );

    assert.equal(event, null);
  });
});
