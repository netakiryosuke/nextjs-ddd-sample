import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Venue } from "../domain/venue/Venue";
import type { VenueRepository } from "../domain/venue/VenueRepository";
import { VenueApplicationService } from "./VenueApplicationService";

describe("VenueApplicationService", () => {
  it("listは会場のEntity一覧を返す", async () => {
    const venue = new Venue("22222222-2222-4222-8222-222222222222", "本館7階 催物会場");
    const venueRepository: VenueRepository = {
      findById: async () => assert.fail("Unexpected repository call"),
      findAll: async () => [venue],
      save: async () => assert.fail("Unexpected repository call"),
    };
    const venueApplicationService = new VenueApplicationService(venueRepository);

    const venues = await venueApplicationService.list();

    assert.deepEqual(venues, [venue]);
    assert.ok(venues[0] instanceof Venue);
  });

  it("listは取得の失敗を呼び出し元へ伝える", async () => {
    const error = new Error("Database unavailable");
    const venueRepository: VenueRepository = {
      findById: async () => assert.fail("Unexpected repository call"),
      findAll: async () => { throw error; },
      save: async () => assert.fail("Unexpected repository call"),
    };
    const venueApplicationService = new VenueApplicationService(venueRepository);

    await assert.rejects(venueApplicationService.list(), error);
  });
});
