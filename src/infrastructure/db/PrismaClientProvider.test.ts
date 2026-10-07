import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { PrismaClientProvider } from "./PrismaClientProvider";

describe("PrismaClientProvider", () => {
  it("トランザクション外では共通Clientを返し、行ロック用のClient取得は拒否する", () => {
    const prismaClient = {} as PrismaClient;
    const prismaClientProvider = new PrismaClientProvider(prismaClient);

    assert.equal(prismaClientProvider.client, prismaClient);
    assert.equal(prismaClientProvider.hasTransaction, false);
    assert.throws(
      () => prismaClientProvider.transactionClient,
      /An active transaction is required/,
    );
  });

  it("並行する非同期処理はそれぞれのTransaction Clientを使う", async () => {
    const prismaClient = {} as PrismaClient;
    const firstTransactionClient = {} as Prisma.TransactionClient;
    const secondTransactionClient = {} as Prisma.TransactionClient;
    const prismaClientProvider = new PrismaClientProvider(prismaClient);
    const firstEntered = Promise.withResolvers<void>();
    const secondEntered = Promise.withResolvers<void>();

    const firstOperation = prismaClientProvider.run(
      firstTransactionClient,
      async () => {
        firstEntered.resolve();
        await secondEntered.promise;
        assert.equal(prismaClientProvider.client, firstTransactionClient);
        assert.equal(prismaClientProvider.hasTransaction, true);
      },
    );
    const secondOperation = prismaClientProvider.run(
      secondTransactionClient,
      async () => {
        secondEntered.resolve();
        await firstEntered.promise;
        assert.equal(prismaClientProvider.client, secondTransactionClient);
      },
    );
    assert.equal(prismaClientProvider.client, prismaClient);
    await Promise.all([firstOperation, secondOperation]);

    assert.equal(prismaClientProvider.client, prismaClient);
    assert.equal(prismaClientProvider.hasTransaction, false);
  });

  it("処理が失敗しても呼び出し元にTransaction Clientが残らない", async () => {
    const prismaClient = {} as PrismaClient;
    const transactionClient = {} as Prisma.TransactionClient;
    const prismaClientProvider = new PrismaClientProvider(prismaClient);
    const operationError = new Error("Operation failed");

    await assert.rejects(
      () =>
        prismaClientProvider.run(transactionClient, async () => {
          throw operationError;
        }),
      (error) => error === operationError,
    );

    assert.equal(prismaClientProvider.client, prismaClient);
    assert.equal(prismaClientProvider.hasTransaction, false);
  });

  it("終了したトランザクションから派生した非同期処理ではDBアクセスを拒否する", async () => {
    const prismaClient = {} as PrismaClient;
    const transactionClient = {} as Prisma.TransactionClient;
    const prismaClientProvider = new PrismaClientProvider(prismaClient);
    const resume = Promise.withResolvers<void>();

    const escapedOperation = await prismaClientProvider.run(
      transactionClient,
      async () => {
        return {
          result: resume.promise.then(() => prismaClientProvider.client),
        };
      },
    );
    resume.resolve();

    await assert.rejects(
      escapedOperation.result,
      /The transaction has already completed/,
    );
    assert.equal(prismaClientProvider.client, prismaClient);
  });
});
