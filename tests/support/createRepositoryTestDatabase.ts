import { randomUUID } from "node:crypto";
import { ReservationStatus } from "../../src/domain/reservation/ReservationStatus";
import { createPrismaClient } from "../../src/infrastructure/db/prismaClient";
import { createTestDatabase } from "./createTestDatabase";

export const VENUE_ID = "22222222-2222-4222-8222-222222222222";
export const EVENT_ID = "11111111-1111-4111-8111-111111111111";
export const VENUE_NAME = "催事会場";
export const EVENT_TITLE = "陶芸ワークショップ";
export const USER_ID = "customer-1";
export const CAPACITY = 3;
export const START_TIME = new Date("2026-10-10T10:00:00.123+09:00");
export const END_TIME = new Date("2026-10-10T11:00:00.123+09:00");
export const RESERVED_AT = new Date("2026-10-01T10:00:00.123+09:00");
export const CANCELLED_AT = new Date("2026-10-02T10:00:00.123+09:00");

export async function createRepositoryTestDatabase() {
  const testDatabase = await createTestDatabase();
  const prismaClient = createPrismaClient(testDatabase.connectionString);

  async function insertEvent(eventId: string, venueId = VENUE_ID) {
    await testDatabase.client.query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [eventId, EVENT_TITLE, venueId, START_TIME, END_TIME, CAPACITY],
    );
  }

  async function insertReservation(
    eventId = EVENT_ID,
    userId = USER_ID,
    status = ReservationStatus.RESERVED,
  ) {
    const reservationId = randomUUID();
    await testDatabase.client.query(
      `INSERT INTO reservations
         (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        reservationId,
        eventId,
        userId,
        status,
        RESERVED_AT,
        status === ReservationStatus.CANCELLED ? CANCELLED_AT : null,
      ],
    );
    return reservationId;
  }

  return {
    client: testDatabase.client,
    prismaClient,
    insertEvent,
    insertReservation,
    async reset() {
      // 各Repositoryのテスト専用スキーマだけを初期化する。
      await testDatabase.client.query("TRUNCATE reservations, events, venues");
      await testDatabase.client.query(
        "INSERT INTO venues (id, name) VALUES ($1, $2)",
        [VENUE_ID, VENUE_NAME],
      );
      await insertEvent(EVENT_ID);
    },
    async close() {
      try {
        await prismaClient.$disconnect();
      } finally {
        await testDatabase.close();
      }
    },
  };
}
