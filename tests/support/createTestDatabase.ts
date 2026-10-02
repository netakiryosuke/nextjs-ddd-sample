import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { Client } from "pg";
import { createPrismaClient } from "../../src/infrastructure/db/prismaClient";

const executeFile = promisify(execFile);
const LOCAL_DATABASE_URL =
  "postgresql://ddd:ddd@127.0.0.1:55432/event_reservation";
const MIGRATION_TIMEOUT_MS = 60_000;

export async function createTestDatabase(): Promise<{
  client: Client;
  prismaClient: ReturnType<typeof createPrismaClient>;
  close(): Promise<void>;
}> {
  const connectionUrl = new URL(
    process.env.TEST_DATABASE_URL ?? LOCAL_DATABASE_URL,
  );
  connectionUrl.searchParams.delete("schema");

  const schemaName = `test_${randomUUID().replaceAll("-", "")}`;
  const migrationUrl = new URL(connectionUrl);
  migrationUrl.searchParams.set("schema", schemaName);

  const admin = new Client({ connectionString: connectionUrl.toString() });
  const client = new Client({ connectionString: connectionUrl.toString() });
  let schemaCreated = false;
  let prismaClient: ReturnType<typeof createPrismaClient> | undefined;

  async function close(): Promise<void> {
    try {
      await prismaClient?.$disconnect();
    } finally {
      try {
        await client.end();
      } finally {
        try {
          if (schemaCreated) {
            // テスト自身が作成したスキーマだけを削除する。
            await admin.query(`DROP SCHEMA ${schemaName} CASCADE`);
          }
        } finally {
          await admin.end();
        }
      }
    }
  }

  await admin.connect();

  try {
    await admin.query(`CREATE SCHEMA ${schemaName}`);
    schemaCreated = true;

    await executeFile(
      process.execPath,
      [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
      {
        env: { ...process.env, DATABASE_URL: migrationUrl.toString() },
        timeout: MIGRATION_TIMEOUT_MS,
      },
    );

    // SQLを正典として変更した際、Prisma側のマッピング更新漏れを検出する。
    await executeFile(
      process.execPath,
      [
        resolve("node_modules/prisma/build/index.js"),
        "migrate",
        "diff",
        "--from-config-datasource",
        "--to-schema",
        "prisma/schema.prisma",
        "--exit-code",
      ],
      {
        env: { ...process.env, DATABASE_URL: migrationUrl.toString() },
        timeout: MIGRATION_TIMEOUT_MS,
      },
    );

    await client.connect();
    await client.query(`SET search_path TO ${schemaName}`);
    prismaClient = createPrismaClient(migrationUrl.toString());

    return {
      client,
      prismaClient,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
