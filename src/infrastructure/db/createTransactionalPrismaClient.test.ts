import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "../../../tests/support/createTestDatabase";
import { PrismaTransactionManager } from "../PrismaTransactionManager";
import { createTransactionalPrismaClient } from "./createTransactionalPrismaClient";
import { PrismaClientProvider } from "./PrismaClientProvider";

describe("createTransactionalPrismaClient", () => {
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

  it("トランザクション外でも標準APIとネイティブSQLを使える", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    await testDatabase.client.query(
      "INSERT INTO venues (id, name) VALUES ($1, $2)",
      [VENUE_ID, "催事会場"],
    );
    const prismaClientProvider = new PrismaClientProvider(
      testDatabase.prismaClient,
    );
    const prisma = createTransactionalPrismaClient(
      testDatabase.prismaClient,
      prismaClientProvider,
    );

    const venue = await prisma.venue.findUnique({ where: { id: VENUE_ID } });
    const venueRecords = await prisma.$queryRaw<
      { name: string }[]
    >`SELECT name FROM venues WHERE id = ${VENUE_ID}`;

    assert.equal(venue?.name, "催事会場");
    assert.deepEqual(venueRecords, [{ name: "催事会場" }]);
  });

  it("事前に保持したモデルやメソッドも実行中のトランザクションへ委譲する", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const prismaClientProvider = new PrismaClientProvider(
      testDatabase.prismaClient,
    );
    const prisma = createTransactionalPrismaClient(
      testDatabase.prismaClient,
      prismaClientProvider,
    );
    const transactionManager = new PrismaTransactionManager(
      testDatabase.prismaClient,
      prismaClientProvider,
    );
    const venueDelegate = prisma.venue;
    const findUnique = venueDelegate.findUnique;
    const queryRaw = prisma.$queryRaw;
    const operationError = new Error("Rollback saved venue");

    await assert.rejects(
      () =>
        transactionManager.execute(async () => {
          await venueDelegate.create({
            data: { id: VENUE_ID, name: "催事会場" },
          });
          assert.equal(
            (await findUnique({ where: { id: VENUE_ID } }))?.name,
            "催事会場",
          );
          assert.deepEqual(
            await queryRaw`SELECT name FROM venues WHERE id = ${VENUE_ID}`,
            [{ name: "催事会場" }],
          );
          throw operationError;
        }),
      (error) => error === operationError,
    );

    assert.equal(await findUnique({ where: { id: VENUE_ID } }), null);
    assert.deepEqual(
      await queryRaw`SELECT name FROM venues WHERE id = ${VENUE_ID}`,
      [],
    );
  });

  it("終了したトランザクションの非同期処理からキャッシュしたメソッドを使っても拒否する", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const prismaClientProvider = new PrismaClientProvider(
      testDatabase.prismaClient,
    );
    const prisma = createTransactionalPrismaClient(
      testDatabase.prismaClient,
      prismaClientProvider,
    );
    const transactionManager = new PrismaTransactionManager(
      testDatabase.prismaClient,
      prismaClientProvider,
    );
    const findUnique = prisma.venue.findUnique;
    const resume = Promise.withResolvers<void>();

    const escapedOperation = await transactionManager.execute(async () => {
      return {
        result: resume.promise.then(() =>
          findUnique({ where: { id: VENUE_ID } }),
        ),
      };
    });
    resume.resolve();

    await assert.rejects(
      escapedOperation.result,
      /The transaction has already completed/,
    );
    assert.equal(await findUnique({ where: { id: VENUE_ID } }), null);
  });
});
