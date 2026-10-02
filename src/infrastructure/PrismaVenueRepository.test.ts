import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "../../tests/support/createTestDatabase";
import { Venue } from "../domain/venue/Venue";
import { PrismaVenueRepository } from "./PrismaVenueRepository";

describe("PrismaVenueRepository", () => {
  let testDatabase: Awaited<
    ReturnType<typeof createTestDatabase>
  >;
  let prismaVenueRepository: PrismaVenueRepository;

  before(async () => {
    testDatabase = await createTestDatabase();
    prismaVenueRepository = new PrismaVenueRepository(
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

  it("findByIdは指定した会場のEntityを返す", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const VENUE_NAME = "催事会場";

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );

    const venue = await prismaVenueRepository.findById(VENUE_ID);
    assert.ok(venue instanceof Venue);
    assert.equal(venue.id, VENUE_ID);
    assert.equal(venue.name, VENUE_NAME);
  });

  it("findByIdは存在しないIDならnullを返す", async () => {
    assert.equal(await prismaVenueRepository.findById(randomUUID()), null);
  });

  it("findAllは会場のEntity一覧を返す", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const VENUE_NAME = "催事会場";

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );

    const venues = await prismaVenueRepository.findAll();
    assert.equal(venues.length, 1);
    assert.ok(venues[0] instanceof Venue);
    assert.equal(venues[0].id, VENUE_ID);
    assert.equal(venues[0].name, VENUE_NAME);
  });

  it("saveは会場を新規保存しEntityを返す", async () => {
    const venueId = randomUUID();
    const venue = await prismaVenueRepository.save(
      new Venue(venueId, "追加会場"),
    );

    assert.ok(venue instanceof Venue);
    assert.equal(venue.id, venueId);
    assert.equal(venue.name, "追加会場");
    assert.deepEqual(await prismaVenueRepository.findById(venueId), venue);
  });

  it("saveは既存の会場を更新しEntityを返す", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const VENUE_NAME = "催事会場";

    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, VENUE_NAME],
    );

    const venue = await prismaVenueRepository.save(
      new Venue(VENUE_ID, "変更後の会場"),
    );

    assert.ok(venue instanceof Venue);
    assert.equal(venue.name, "変更後の会場");
    assert.deepEqual(await prismaVenueRepository.findById(VENUE_ID), venue);
    assert.equal((await prismaVenueRepository.findAll()).length, 1);
  });
});
