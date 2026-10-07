import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma, PrismaClient } from "../generated/prisma/client";

type TransactionContext = {
  client: Prisma.TransactionClient;
  active: boolean;
};

export class PrismaClientProvider {
  private readonly transactionContext =
    new AsyncLocalStorage<TransactionContext>();

  constructor(private readonly prisma: PrismaClient) {}

  get client(): Prisma.TransactionClient {
    return this.hasTransaction ? this.transactionClient : this.prisma;
  }

  get hasTransaction(): boolean {
    return this.transactionContext.getStore() !== undefined;
  }

  get transactionClient(): Prisma.TransactionClient {
    const context = this.transactionContext.getStore();

    if (context === undefined) {
      throw new Error("An active transaction is required");
    }

    if (!context.active) {
      throw new Error("The transaction has already completed");
    }

    return context.client;
  }

  async run<T>(
    client: Prisma.TransactionClient,
    operation: () => Promise<T>,
  ): Promise<T> {
    const context: TransactionContext = { client, active: true };

    return this.transactionContext.run(context, async () => {
      try {
        return await operation();
      } finally {
        context.active = false;
      }
    });
  }
}
