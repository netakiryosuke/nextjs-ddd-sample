import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  createRepositoryTestDatabase,
  VENUE_NAME,
  EVENT_ID,
  USER_ID,
} from "../../tests/support/createRepositoryTestDatabase";
import { Event } from "../domain/event/Event";
import { EventAvailability } from "../domain/event/EventAvailability";
import { EventPeriod } from "../domain/event/EventPeriod";
import { ReservationStatus } from "../domain/reservation/ReservationStatus";
import { Venue } from "../domain/venue/Venue";
import { EventAvailabilityDao } from "./dao/EventAvailabilityDao";
import { PrismaEventAvailabilityRepository } from "./PrismaEventAvailabilityRepository";

describe("PrismaEventAvailabilityRepository", () => {
  let repositoryTestDatabase: Awaited<
    ReturnType<typeof createRepositoryTestDatabase>
  >;
  let prismaEventAvailabilityRepository: PrismaEventAvailabilityRepository;

  before(async () => {
    repositoryTestDatabase = await createRepositoryTestDatabase();
    prismaEventAvailabilityRepository = new PrismaEventAvailabilityRepository(
      new EventAvailabilityDao(repositoryTestDatabase.prismaClient),
    );
  });

  beforeEach(async () => {
    await repositoryTestDatabase.reset();
  });

  after(async () => {
    await repositoryTestDatabase?.close();
  });

  it("findByIdは催事と有効予約数を持つEntityを返す", async () => {
    await repositoryTestDatabase.insertReservation();
    await repositoryTestDatabase.insertReservation(EVENT_ID, "customer-2");
    await repositoryTestDatabase.insertReservation(
      EVENT_ID,
      "customer-3",
      ReservationStatus.CANCELLED,
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
    const eventAvailability =
      await prismaEventAvailabilityRepository.findById(EVENT_ID);
    assert.ok(eventAvailability instanceof EventAvailability);
    assert.equal(eventAvailability.reservationCount, 0);
  });

  it("findByIdはキャンセル済み予約を有効予約数に含めない", async () => {
    await repositoryTestDatabase.insertReservation(
      EVENT_ID,
      USER_ID,
      ReservationStatus.CANCELLED,
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
    const otherEventId = randomUUID();
    await repositoryTestDatabase.insertEvent(otherEventId);
    await repositoryTestDatabase.insertReservation();
    await repositoryTestDatabase.insertReservation(
      otherEventId,
      USER_ID,
      ReservationStatus.CANCELLED,
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
