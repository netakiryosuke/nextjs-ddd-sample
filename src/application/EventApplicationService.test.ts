import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { Event } from "../domain/event/Event";
import { EventAvailability } from "../domain/event/EventAvailability";
import type { EventAvailabilityRepository } from "../domain/event/EventAvailabilityRepository";
import { EventPeriod } from "../domain/event/EventPeriod";
import type { EventRepository } from "../domain/event/EventRepository";
import { Venue } from "../domain/venue/Venue";
import { EventApplicationService } from "./EventApplicationService";

function unexpectedRepositoryCall(): never {
  assert.fail("Unexpected repository call");
}

describe("EventApplicationService", () => {
  it("listは催事のEntity一覧を返す", async () => {
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

    const eventRepository: EventRepository = {
      findByIdForUpdate: unexpectedRepositoryCall,
      findById: unexpectedRepositoryCall,
      findAll: async () => [event],
      save: unexpectedRepositoryCall,
    };
    const eventAvailabilityRepository: EventAvailabilityRepository = {
      findById: unexpectedRepositoryCall,
      findAll: unexpectedRepositoryCall,
    };

    const eventApplicationService = new EventApplicationService(
      eventRepository,
      eventAvailabilityRepository,
    );

    const events = await eventApplicationService.list();

    assert.deepEqual(events, [event]);
    assert.ok(events[0] instanceof Event);
  });

  it("listは催事がなければ空配列を返す", async () => {
    const eventRepository: EventRepository = {
      findByIdForUpdate: unexpectedRepositoryCall,
      findById: unexpectedRepositoryCall,
      findAll: async () => [],
      save: unexpectedRepositoryCall,
    };
    const eventAvailabilityRepository: EventAvailabilityRepository = {
      findById: unexpectedRepositoryCall,
      findAll: unexpectedRepositoryCall,
    };

    const eventApplicationService = new EventApplicationService(
      eventRepository,
      eventAvailabilityRepository,
    );

    assert.deepEqual(await eventApplicationService.list(), []);
  });

  it("lookupは指定した催事の空き状況をEntityで返す", async () => {
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
    const eventAvailability = new EventAvailability(event, 1);
    const findAvailabilityById = mock.fn<EventAvailabilityRepository["findById"]>(
      async () => eventAvailability,
    );

    const eventRepository: EventRepository = {
      findByIdForUpdate: unexpectedRepositoryCall,
      findById: unexpectedRepositoryCall,
      findAll: unexpectedRepositoryCall,
      save: unexpectedRepositoryCall,
    };
    const eventAvailabilityRepository: EventAvailabilityRepository = {
      findById: findAvailabilityById,
      findAll: unexpectedRepositoryCall,
    };

    const eventApplicationService = new EventApplicationService(
      eventRepository,
      eventAvailabilityRepository,
    );

    const lookedUpEventAvailability = await eventApplicationService.lookup(event.id);

    assert.equal(lookedUpEventAvailability, eventAvailability);
    assert.ok(lookedUpEventAvailability instanceof EventAvailability);
    assert.equal(findAvailabilityById.mock.callCount(), 1);
    assert.deepEqual(findAvailabilityById.mock.calls[0].arguments, [event.id]);
  });

  it("lookupは催事がなければnullを返す", async () => {
    const eventRepository: EventRepository = {
      findByIdForUpdate: unexpectedRepositoryCall,
      findById: unexpectedRepositoryCall,
      findAll: unexpectedRepositoryCall,
      save: unexpectedRepositoryCall,
    };
    const eventAvailabilityRepository: EventAvailabilityRepository = {
      findById: async () => null,
      findAll: unexpectedRepositoryCall,
    };

    const eventApplicationService = new EventApplicationService(
      eventRepository,
      eventAvailabilityRepository,
    );

    assert.equal(
      await eventApplicationService.lookup(
        "11111111-1111-4111-8111-111111111111",
      ),
      null,
    );
  });

  it("lookupは取得の失敗を存在しない催事として扱わず呼び出し元へ伝える", async () => {
    const repositoryError = new Error("Repository unavailable");

    const eventRepository: EventRepository = {
      findByIdForUpdate: unexpectedRepositoryCall,
      findById: unexpectedRepositoryCall,
      findAll: unexpectedRepositoryCall,
      save: unexpectedRepositoryCall,
    };
    const eventAvailabilityRepository: EventAvailabilityRepository = {
      findById: async () => {
        throw repositoryError;
      },
      findAll: unexpectedRepositoryCall,
    };

    const eventApplicationService = new EventApplicationService(
      eventRepository,
      eventAvailabilityRepository,
    );

    await assert.rejects(
      () =>
        eventApplicationService.lookup("11111111-1111-4111-8111-111111111111"),
      (error) => error === repositoryError,
    );
  });
});
