import type { TransactionManager } from "../application/TransactionManager";
import { PrismaClientProvider } from "./db/PrismaClientProvider";
import { Prisma, PrismaClient } from "./generated/prisma/client";

export class PrismaTransactionManager implements TransactionManager {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly prismaClientProvider: PrismaClientProvider,
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.prismaClientProvider.hasTransaction) {
      throw new Error("Nested transactions are not supported");
    }

    return this.prisma.$transaction(
      (transaction) => this.prismaClientProvider.run(transaction, operation),
      {
        // ロック待ち中のコミットを後続の読み取りに反映する。
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}
