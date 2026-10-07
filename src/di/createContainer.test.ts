import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { EventApplicationService } from "../application/event/EventApplicationService";
import { ReservationApplicationService } from "../application/reservation/ReservationApplicationService";
import type { ReservationTransactionManager } from "../application/reservation/ReservationTransactionManager";
import { Event } from "../domain/event/Event";
import { EventAvailability } from "../domain/event/EventAvailability";
import type { EventAvailabilityRepository } from "../domain/event/EventAvailabilityRepository";
import type { EventRepository } from "../domain/event/EventRepository";
import type { ReservationRepository } from "../domain/reservation/ReservationRepository";
import type { VenueRepository } from "../domain/venue/VenueRepository";
import { EventAvailabilityDao } from "../infrastructure/dao/EventAvailabilityDao";
import { EventDao } from "../infrastructure/dao/EventDao";
import { createPrismaClient } from "../infrastructure/db/prismaClient";
import { PrismaEventAvailabilityRepository } from "../infrastructure/PrismaEventAvailabilityRepository";
import { PrismaEventRepository } from "../infrastructure/PrismaEventRepository";
import { PrismaReservationRepository } from "../infrastructure/PrismaReservationRepository";
import { PrismaReservationTransactionManager } from "../infrastructure/PrismaReservationTransactionManager";
import { PrismaVenueRepository } from "../infrastructure/PrismaVenueRepository";
import { createContainer } from "./createContainer";
import { TOKENS } from "./tokens";

describe("createContainer", () => {
  it("Service・Repository・DAOをsingletonとして解決する", async (context) => {
    const prismaClient = createPrismaClient(
      "postgresql://ddd:ddd@localhost:5432/event_reservation?schema=public",
    );
    context.after(() => prismaClient.$disconnect());

    const container = createContainer(prismaClient);
    const eventApplicationService = container.get(EventApplicationService);
    const reservationApplicationService = container.get(
      ReservationApplicationService,
    );
    const reservationTransactionManager = container.get<ReservationTransactionManager>(
      TOKENS.ReservationTransactionManager,
    );
    const eventRepository = container.get<EventRepository>(TOKENS.EventRepository);
    const eventAvailabilityRepository = container.get<EventAvailabilityRepository>(
      TOKENS.EventAvailabilityRepository,
    );
    const reservationRepository = container.get<ReservationRepository>(
      TOKENS.ReservationRepository,
    );
    const venueRepository = container.get<VenueRepository>(TOKENS.VenueRepository);
    const eventDao = container.get(EventDao);
    const eventAvailabilityDao = container.get(EventAvailabilityDao);

    assert.ok(eventApplicationService instanceof EventApplicationService);
    assert.ok(
      reservationApplicationService instanceof ReservationApplicationService,
    );
    assert.ok(reservationTransactionManager instanceof PrismaReservationTransactionManager);
    assert.strictEqual(
      container.get(ReservationApplicationService),
      reservationApplicationService,
    );
    assert.strictEqual(
      container.get(TOKENS.ReservationTransactionManager),
      reservationTransactionManager,
    );
    assert.ok(eventRepository instanceof PrismaEventRepository);
    assert.ok(
      eventAvailabilityRepository instanceof PrismaEventAvailabilityRepository,
    );
    assert.ok(reservationRepository instanceof PrismaReservationRepository);
    assert.ok(venueRepository instanceof PrismaVenueRepository);
    assert.strictEqual(
      container.get(EventApplicationService),
      eventApplicationService,
    );
    assert.strictEqual(container.get(TOKENS.EventRepository), eventRepository);
    assert.strictEqual(
      container.get(TOKENS.EventAvailabilityRepository),
      eventAvailabilityRepository,
    );
    assert.strictEqual(
      container.get(TOKENS.ReservationRepository),
      reservationRepository,
    );
    assert.strictEqual(container.get(TOKENS.VenueRepository), venueRepository);
    assert.strictEqual(container.get(EventDao), eventDao);
    assert.strictEqual(container.get(EventAvailabilityDao), eventAvailabilityDao);
    assert.strictEqual(container.get(TOKENS.PrismaClient), prismaClient);
  });

  it("解決したServiceから注入されたRepository・DAOを利用する", async (context) => {
    const prismaClient = createPrismaClient(
      "postgresql://ddd:ddd@localhost:5432/event_reservation?schema=public",
    );
    context.after(() => prismaClient.$disconnect());
    const eventDto = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "陶芸ワークショップ",
      venue_id: "22222222-2222-4222-8222-222222222222",
      venue_name: "催事会場",
      start_time: new Date("2026-10-10T10:00:00+09:00"),
      end_time: new Date("2026-10-10T11:00:00+09:00"),
      capacity: 3,
    };

    const container = createContainer(prismaClient);
    const selectAll = mock.method(
      container.get(EventDao),
      "selectAll",
      async () => [eventDto],
    );
    const selectById = mock.method(
      container.get(EventAvailabilityDao),
      "selectById",
      async () => ({ ...eventDto, reservation_count: 2 }),
    );
    context.after(() => selectAll.mock.restore());
    context.after(() => selectById.mock.restore());
    const eventApplicationService = container.get(EventApplicationService);

    const events = await eventApplicationService.list();
    const eventAvailability = await eventApplicationService.lookup(
      "11111111-1111-4111-8111-111111111111",
    );

    assert.equal(events.length, 1);
    assert.ok(events[0] instanceof Event);
    assert.equal(events[0].title, "陶芸ワークショップ");
    assert.ok(eventAvailability instanceof EventAvailability);
    assert.equal(eventAvailability.event.id, events[0].id);
    assert.equal(eventAvailability.reservationCount, 2);
    assert.equal(selectAll.mock.callCount(), 1);
    assert.equal(selectById.mock.callCount(), 1);
    assert.deepEqual(selectById.mock.calls[0].arguments, [eventDto.id]);
  });

  it("依存するRepositoryの登録漏れを解決時に検出する", async (context) => {
    const prismaClient = createPrismaClient(
      "postgresql://ddd:ddd@localhost:5432/event_reservation?schema=public",
    );
    context.after(() => prismaClient.$disconnect());

    const container = createContainer(prismaClient);
    await container.unbindAsync(TOKENS.EventRepository);

    assert.throws(
      () => container.get(EventApplicationService),
      /No bindings found[\s\S]*EventRepository/,
    );
  });

  it("同じRepositoryに複数実装を登録すると解決時に検出する", async (context) => {
    const prismaClient = createPrismaClient(
      "postgresql://ddd:ddd@localhost:5432/event_reservation?schema=public",
    );
    context.after(() => prismaClient.$disconnect());

    const container = createContainer(prismaClient);
    const eventRepository: EventRepository = {
      findById: async () => null,
      findAll: async () => [],
      save: async (event) => event,
    };
    container
      .bind<EventRepository>(TOKENS.EventRepository)
      .toConstantValue(eventRepository);

    assert.throws(
      () => container.get(EventApplicationService),
      /Ambiguous bindings found[\s\S]*EventRepository/,
    );
  });
});
