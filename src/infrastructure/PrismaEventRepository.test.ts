import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  createRepositoryTestDatabase,
  VENUE_ID,
  VENUE_NAME,
  EVENT_ID,
  EVENT_TITLE,
  CAPACITY,
  START_TIME,
  END_TIME,
} from "../../tests/support/createRepositoryTestDatabase";
import { Event } from "../domain/event/Event";
import { EventPeriod } from "../domain/event/EventPeriod";
import { Venue } from "../domain/venue/Venue";
import { EventDao } from "./dao/EventDao";
import { PrismaEventRepository } from "./PrismaEventRepository";

describe("PrismaEventRepository", () => {
  let repositoryTestDatabase: Awaited<
    ReturnType<typeof createRepositoryTestDatabase>
  >;
  let prismaEventRepository: PrismaEventRepository;

  before(async () => {
    repositoryTestDatabase = await createRepositoryTestDatabase();
    prismaEventRepository = new PrismaEventRepository(
      repositoryTestDatabase.prismaClient,
      new EventDao(repositoryTestDatabase.prismaClient),
    );
  });

  beforeEach(async () => {
    await repositoryTestDatabase.reset();
  });

  after(async () => {
    await repositoryTestDatabase?.close();
  });

  it("findByIdは会場と開催期間を持つ催事のEntityを返す", async () => {
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
    const otherVenueId = randomUUID();
    const otherEventId = randomUUID();
    await repositoryTestDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [otherVenueId, "別会場"],
    );
    await repositoryTestDatabase.insertEvent(otherEventId, otherVenueId);
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

  it("saveは催事を新規保存しEntityを返す", async () => {
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
});
