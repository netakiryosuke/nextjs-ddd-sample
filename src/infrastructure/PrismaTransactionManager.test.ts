import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "../../tests/support/createTestDatabase";
import { ReservationApplicationService } from "../application/ReservationApplicationService";
import { EventNotReservableError } from "../domain/event/EventNotReservableError";
import { DuplicateReservationError } from "../domain/reservation/DuplicateReservationError";
import { ReservationAlreadyCancelledError } from "../domain/reservation/ReservationAlreadyCancelledError";
import { Reservation } from "../domain/reservation/Reservation";
import { ReservationStatus } from "../domain/reservation/ReservationStatus";
import { createContainer } from "../di/createContainer";
import type { TransactionManager } from "../application/TransactionManager";
import type { ReservationRepository } from "../domain/reservation/ReservationRepository";
import { TOKENS } from "../di/tokens";
import type { EventRepository } from "../domain/event/EventRepository";
import type { EventAvailabilityRepository } from "../domain/event/EventAvailabilityRepository";
import type { VenueRepository } from "../domain/venue/VenueRepository";
import { Event } from "../domain/event/Event";
import { EventPeriod } from "../domain/event/EventPeriod";
import { Venue } from "../domain/venue/Venue";

describe("PrismaTransactionManager", () => {
  let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>;

  before(async () => {
    testDatabase = await createTestDatabase();
  });

  beforeEach(async () => {
    await testDatabase.client.query("TRUNCATE reservations, events, venues");
  });

  after(async () => {
    await testDatabase?.close();
  });

  it("最後の1席への同時予約は1件だけ成立する", async () => {
    const CAPACITY = 1;
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
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
        "2099-10-10T10:00:00+09:00",
        "2099-10-10T11:00:00+09:00",
        CAPACITY,
      ],
    );

    const reservationApplicationService = createContainer(
      testDatabase.prismaClient,
    ).get(ReservationApplicationService);

    const results = await Promise.allSettled([
      reservationApplicationService.reserve(EVENT_ID, "customer-1"),
      reservationApplicationService.reserve(EVENT_ID, "customer-2"),
    ]);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const rejectedResult = results.find(
      (result) => result.status === "rejected",
    );
    assert.ok(rejectedResult?.reason instanceof EventNotReservableError);
    const reservationRecords = await testDatabase.client.query(
      "SELECT * FROM reservations WHERE status = 'reserved'",
    );
    assert.equal(reservationRecords.rowCount, 1);
  });

  it("同じ利用者の同時予約は有効な予約が1件だけ成立する", async () => {
    const CAPACITY = 3;
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
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
        "2099-10-10T10:00:00+09:00",
        "2099-10-10T11:00:00+09:00",
        CAPACITY,
      ],
    );

    const reservationApplicationService = createContainer(
      testDatabase.prismaClient,
    ).get(ReservationApplicationService);

    const results = await Promise.allSettled([
      reservationApplicationService.reserve(EVENT_ID, "customer-1"),
      reservationApplicationService.reserve(EVENT_ID, "customer-1"),
    ]);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const rejectedResult = results.find(
      (result) => result.status === "rejected",
    );
    assert.ok(rejectedResult?.reason instanceof DuplicateReservationError);
    const reservationRecords = await testDatabase.client.query(
      "SELECT * FROM reservations WHERE status = 'reserved'",
    );
    assert.equal(reservationRecords.rowCount, 1);
  });

  it("コールバックの失敗で予約の保存をロールバックする", async () => {
    const CAPACITY = 1;
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
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
        "2099-10-10T10:00:00+09:00",
        "2099-10-10T11:00:00+09:00",
        CAPACITY,
      ],
    );

    const container = createContainer(testDatabase.prismaClient);
    const transactionManager = container.get<TransactionManager>(
      TOKENS.TransactionManager,
    );
    const reservationRepository = container.get<ReservationRepository>(
      TOKENS.ReservationRepository,
    );
    const operationError = new Error("Operation failed after saving");

    await assert.rejects(
      () =>
        transactionManager.execute(async () => {
          await reservationRepository.save(
            new Reservation(
              "33333333-3333-4333-8333-333333333333",
              EVENT_ID,
              "customer-1",
              ReservationStatus.RESERVED,
              new Date("2026-10-01T10:00:00+09:00"),
              null,
            ),
          );
          throw operationError;
        }),
      (error) => error === operationError,
    );

    const reservationRecords = await testDatabase.client.query(
      "SELECT * FROM reservations",
    );
    assert.equal(reservationRecords.rowCount, 0);
  });

  it("キャンセルの履歴を残し、新しいIDで再予約できる", async () => {
    const CAPACITY = 1;
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
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
        "2099-10-10T10:00:00+09:00",
        "2099-10-10T11:00:00+09:00",
        CAPACITY,
      ],
    );

    const reservationApplicationService = createContainer(
      testDatabase.prismaClient,
    ).get(ReservationApplicationService);

    const reservation = await reservationApplicationService.reserve(
      EVENT_ID,
      "customer-1",
    );
    const cancelledReservation = await reservationApplicationService.cancel(
      reservation.id,
      "customer-1",
    );
    const newReservation = await reservationApplicationService.reserve(
      EVENT_ID,
      "customer-1",
    );

    assert.ok(cancelledReservation instanceof Reservation);
    assert.notEqual(cancelledReservation, reservation);
    assert.equal(reservation.status, ReservationStatus.RESERVED);
    assert.equal(reservation.cancelledAt, null);
    assert.equal(cancelledReservation.status, ReservationStatus.CANCELLED);
    assert.ok(cancelledReservation.cancelledAt instanceof Date);
    assert.notEqual(newReservation.id, reservation.id);
    const reservationRecords = await testDatabase.client.query(
      "SELECT id, status FROM reservations ORDER BY status, id",
    );
    assert.deepEqual(reservationRecords.rows, [
      { id: newReservation.id, status: ReservationStatus.RESERVED },
      { id: reservation.id, status: ReservationStatus.CANCELLED },
    ]);
  });

  it("同じ予約への同時キャンセルは1件だけ成立する", async () => {
    const CAPACITY = 1;
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
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
        "2099-10-10T10:00:00+09:00",
        "2099-10-10T11:00:00+09:00",
        CAPACITY,
      ],
    );

    const reservationApplicationService = createContainer(
      testDatabase.prismaClient,
    ).get(ReservationApplicationService);
    const reservation = await reservationApplicationService.reserve(
      EVENT_ID,
      "customer-1",
    );

    const results = await Promise.allSettled([
      reservationApplicationService.cancel(reservation.id, "customer-1"),
      reservationApplicationService.cancel(reservation.id, "customer-1"),
    ]);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const rejectedResult = results.find(
      (result) => result.status === "rejected",
    );
    assert.ok(
      rejectedResult?.reason instanceof ReservationAlreadyCancelledError,
    );
    const reservationRecords = await testDatabase.client.query(
      "SELECT status, cancelled_at FROM reservations WHERE id = $1",
      [reservation.id],
    );
    assert.equal(
      reservationRecords.rows[0].status,
      ReservationStatus.CANCELLED,
    );
    assert.ok(reservationRecords.rows[0].cancelled_at instanceof Date);
  });
  it("予約に依存せず会場と催事を同一トランザクションで保存し、DAOからも取得できる", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const venue = new Venue(VENUE_ID, "新しい会場");
    const event = new Event(
      EVENT_ID,
      "新しい催事",
      venue,
      new EventPeriod(
        new Date("2099-10-10T10:00:00+09:00"),
        new Date("2099-10-10T11:00:00+09:00"),
      ),
      3,
    );
    const container = createContainer(testDatabase.prismaClient);
    const transactionManager = container.get<TransactionManager>(
      TOKENS.TransactionManager,
    );
    const venueRepository = container.get<VenueRepository>(
      TOKENS.VenueRepository,
    );
    const eventRepository = container.get<EventRepository>(
      TOKENS.EventRepository,
    );
    const eventAvailabilityRepository =
      container.get<EventAvailabilityRepository>(
        TOKENS.EventAvailabilityRepository,
      );

    const eventAvailability = await transactionManager.execute(async () => {
      await venueRepository.save(venue);
      await eventRepository.save(event);
      const savedEvent = await eventRepository.findById(EVENT_ID);
      assert.equal(savedEvent?.title, event.title);
      return eventAvailabilityRepository.findById(EVENT_ID);
    });

    assert.equal(eventAvailability?.event.venueName, venue.name);
    assert.equal(eventAvailability?.reservationCount, 0);
    assert.equal((await venueRepository.findById(VENUE_ID))?.name, venue.name);
    assert.equal(
      (await eventRepository.findById(EVENT_ID))?.title,
      event.title,
    );
  });

  it("複数Repositoryの保存をまとめてロールバックする", async () => {
    const venue = new Venue(
      "22222222-2222-4222-8222-222222222222",
      "新しい会場",
    );
    const event = new Event(
      "11111111-1111-4111-8111-111111111111",
      "新しい催事",
      venue,
      new EventPeriod(
        new Date("2099-10-10T10:00:00+09:00"),
        new Date("2099-10-10T11:00:00+09:00"),
      ),
      3,
    );
    const container = createContainer(testDatabase.prismaClient);
    const transactionManager = container.get<TransactionManager>(
      TOKENS.TransactionManager,
    );
    const venueRepository = container.get<VenueRepository>(
      TOKENS.VenueRepository,
    );
    const eventRepository = container.get<EventRepository>(
      TOKENS.EventRepository,
    );
    const operationError = new Error("Operation failed after saving");

    await assert.rejects(
      () =>
        transactionManager.execute(async () => {
          await venueRepository.save(venue);
          await eventRepository.save(event);
          throw operationError;
        }),
      (error) => error === operationError,
    );

    assert.equal(await venueRepository.findById(venue.id), null);
    assert.ok(event.id);
    assert.equal(await eventRepository.findById(event.id), null);
  });

  it("一方のトランザクションの失敗が並行する別のトランザクションに影響しない", async () => {
    const firstVenue = new Venue(
      "11111111-1111-4111-8111-111111111111",
      "保存する会場",
    );
    const secondVenue = new Venue(
      "22222222-2222-4222-8222-222222222222",
      "保存しない会場",
    );
    const container = createContainer(testDatabase.prismaClient);
    const transactionManager = container.get<TransactionManager>(
      TOKENS.TransactionManager,
    );
    const venueRepository = container.get<VenueRepository>(
      TOKENS.VenueRepository,
    );
    const firstSaved = Promise.withResolvers<void>();
    const secondSaved = Promise.withResolvers<void>();
    const operationError = new Error("Rollback second operation");

    const results = await Promise.allSettled([
      transactionManager.execute(async () => {
        await venueRepository.save(firstVenue);
        firstSaved.resolve();
        await secondSaved.promise;
        assert.equal(await venueRepository.findById(secondVenue.id), null);
        return venueRepository.findById(firstVenue.id);
      }),
      transactionManager.execute(async () => {
        await firstSaved.promise;
        await venueRepository.save(secondVenue);
        secondSaved.resolve();
        throw operationError;
      }),
    ]);

    assert.equal(results[0].status, "fulfilled");
    assert.equal(results[1].status, "rejected");
    assert.equal(
      (await venueRepository.findById(firstVenue.id))?.name,
      firstVenue.name,
    );
    assert.equal(await venueRepository.findById(secondVenue.id), null);
  });

  it("executeの入れ子を拒否し、外側のトランザクションもロールバックする", async () => {
    const venue = new Venue(
      "22222222-2222-4222-8222-222222222222",
      "新しい会場",
    );
    const container = createContainer(testDatabase.prismaClient);
    const transactionManager = container.get<TransactionManager>(
      TOKENS.TransactionManager,
    );
    const venueRepository = container.get<VenueRepository>(
      TOKENS.VenueRepository,
    );

    await assert.rejects(
      () =>
        transactionManager.execute(async () => {
          await venueRepository.save(venue);
          await transactionManager.execute(async () =>
            venueRepository.findById(venue.id),
          );
        }),
      /Nested transactions are not supported/,
    );

    assert.equal(await venueRepository.findById(venue.id), null);
  });
});
