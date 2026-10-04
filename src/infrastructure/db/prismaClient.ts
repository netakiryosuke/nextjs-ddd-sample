import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const LOCAL_DATABASE_URL =
  "postgresql://ddd:ddd@localhost:55433/event_reservation?schema=public";
const DEFAULT_SCHEMA = "public";

export function createPrismaClient(databaseUrl: string, logQueries = false) {
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get("schema") ?? DEFAULT_SCHEMA;
  url.searchParams.delete("schema");

  const adapter = new PrismaPg(
    {
      connectionString: url.toString(),
      // ネイティブSQLとモデル操作が同じスキーマを参照するようにする。
      options: `-c search_path=${schema}`,
    },
    { schema },
  );
  return new PrismaClient({
    adapter,
    log: logQueries ? [{ emit: "event", level: "query" }] : [],
  });
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
