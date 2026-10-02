import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "../../../tests/support/createTestDatabase";

const POSTGRES_ERROR = {
  CHECK_VIOLATION: "23514",
  FOREIGN_KEY_VIOLATION: "23503",
  UNIQUE_VIOLATION: "23505",
  RESTRICT_VIOLATION: "23001",
  INVALID_TEXT_REPRESENTATION: "22P02",
  STRING_DATA_RIGHT_TRUNCATION: "22001",
} as const;

describe("DB schema", { concurrency: false }, () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>> | undefined;

  before(async () => {
    database = await createTestDatabase();
  });

  after(async () => {
    await database?.close();
  });

  function client() {
    assert.ok(database);
    return database.client;
  }

  beforeEach(async () => {
    // 各テストのデータと失敗したSQLを、次のテストへ持ち越さない。
    await client().query("BEGIN");
  });

  afterEach(async () => {
    await database?.client.query("ROLLBACK");
  });

  it("初回Migrationを適用し、日時を同じ時点として保存できる", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const USER_ID = "customer-1";
    const START_TIME = "2026-10-10T10:00:00+09:00";
    const END_TIME = "2026-10-10T11:00:00+09:00";
    const RESERVED_AT = "2026-10-01T10:00:00+09:00";

    await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
      VENUE_ID,
      "催事会場",
    ]);
    await client().query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
    );

    const migration = await client().query(
      "SELECT migration_name, finished_at FROM _prisma_migrations",
    );

    assert.ok(migration.rows.some((row) => row.migration_name === "0_init"));
    assert.ok(migration.rows.every((row) => row.finished_at));

    const reservation = await client().query(
      `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, reserved_at, cancelled_at`,
      [randomUUID(), EVENT_ID, USER_ID, "reserved", RESERVED_AT, null],
    );

    assert.equal(reservation.rows[0].status, "reserved");
    assert.equal(reservation.rows[0].cancelled_at, null);
    assert.equal(
      reservation.rows[0].reserved_at.getTime(),
      new Date(RESERVED_AT).getTime(),
    );
  });

  it("同じ利用者の同じ催事への有効な予約を重複させられない", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const USER_ID = "customer-1";
    const START_TIME = "2026-10-10T10:00:00+09:00";
    const END_TIME = "2026-10-10T11:00:00+09:00";
    const RESERVED_AT = "2026-10-01T10:00:00+09:00";

    await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
      VENUE_ID,
      "催事会場",
    ]);
    await client().query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
    );

    await client().query(
      `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, reserved_at, cancelled_at`,
      [randomUUID(), EVENT_ID, USER_ID, "reserved", RESERVED_AT, null],
    );
    await assert.rejects(
      () =>
        client().query(
          `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, status, reserved_at, cancelled_at`,
          [randomUUID(), EVENT_ID, USER_ID, "reserved", RESERVED_AT, null],
        ),
      {
        code: POSTGRES_ERROR.UNIQUE_VIOLATION,
        constraint: "reservations_event_user_reserved_key",
      },
    );
  });

  it("IDとその参照にUUID形式以外の文字列も保存できる", async () => {
    const START_TIME = "2026-10-10T10:00:00+09:00";
    const END_TIME = "2026-10-10T11:00:00+09:00";
    const RESERVED_AT = "2026-10-01T10:00:00+09:00";

    await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
      "venue-1",
      "追加会場",
    ]);
    await client().query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ["event-1", "追加催事", "venue-1", START_TIME, END_TIME, 2],
    );

    const reservation = await client().query(
      `INSERT INTO reservations (id, event_id, user_id, status, reserved_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, event_id, user_id`,
      ["reservation-1", "event-1", "customer-2", "reserved", RESERVED_AT],
    );

    assert.deepEqual(reservation.rows[0], {
      id: "reservation-1",
      event_id: "event-1",
      user_id: "customer-2",
    });
  });

  it("キャンセル後は新しい予約を作れ、複数のキャンセル記録を残せる", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const USER_ID = "customer-1";
    const START_TIME = "2026-10-10T10:00:00+09:00";
    const END_TIME = "2026-10-10T11:00:00+09:00";
    const RESERVED_AT = "2026-10-01T10:00:00+09:00";
    const CANCELLED_AT = "2026-10-02T10:00:00+09:00";

    await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
      VENUE_ID,
      "催事会場",
    ]);
    await client().query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
    );

    const first = await client().query(
      `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, reserved_at, cancelled_at`,
      [randomUUID(), EVENT_ID, USER_ID, "reserved", RESERVED_AT, null],
    );
    await client().query(
      "UPDATE reservations SET status = 'cancelled', cancelled_at = $1 WHERE id = $2",
      [CANCELLED_AT, first.rows[0].id],
    );
    await client().query(
      `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, reserved_at, cancelled_at`,
      [randomUUID(), EVENT_ID, USER_ID, "cancelled", RESERVED_AT, CANCELLED_AT],
    );
    await client().query(
      `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, reserved_at, cancelled_at`,
      [randomUUID(), EVENT_ID, USER_ID, "reserved", RESERVED_AT, null],
    );

    const counts = await client().query(
      "SELECT status, COUNT(*)::integer AS count FROM reservations GROUP BY status",
    );

    assert.deepEqual(
      Object.fromEntries(counts.rows.map((row) => [row.status, row.count])),
      { reserved: 1, cancelled: 2 },
    );
  });

  for (const [table, column] of [
    ["venues", "id"],
    ["events", "id"],
    ["events", "venue_id"],
    ["reservations", "id"],
    ["reservations", "event_id"],
  ] as const) {
    it(`${table}.${column} に36文字を超えるIDを保存できない`, async () => {
      const VENUE_ID = "22222222-2222-4222-8222-222222222222";
      const EVENT_ID = "11111111-1111-4111-8111-111111111111";
      const USER_ID = "customer-1";
      const START_TIME = "2026-10-10T10:00:00+09:00";
      const END_TIME = "2026-10-10T11:00:00+09:00";
      const RESERVED_AT = "2026-10-01T10:00:00+09:00";

      await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
        VENUE_ID,
        "催事会場",
      ]);
      await client().query(
        `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
      );

      if (table === "reservations") {
        await client().query(
          `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, status, reserved_at, cancelled_at`,
          [randomUUID(), EVENT_ID, USER_ID, "reserved", RESERVED_AT, null],
        );
      }
      await assert.rejects(
        () =>
          client().query(`UPDATE ${table} SET ${column} = $1`, [
            `${randomUUID()}x`,
          ]),
        { code: POSTGRES_ERROR.STRING_DATA_RIGHT_TRUNCATION },
      );
    });
  }

  for (const capacity of [0, -1]) {
    it(`定員 ${capacity} の催事を保存できない`, async () => {
      const VENUE_ID = "22222222-2222-4222-8222-222222222222";
      const EVENT_ID = "11111111-1111-4111-8111-111111111111";
      const START_TIME = "2026-10-10T10:00:00+09:00";
      const END_TIME = "2026-10-10T11:00:00+09:00";

      await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
        VENUE_ID,
        "催事会場",
      ]);
      await client().query(
        `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
      );

      await assert.rejects(
        () =>
          client().query("UPDATE events SET capacity = $1 WHERE id = $2", [
            capacity,
            EVENT_ID,
          ]),
        {
          code: POSTGRES_ERROR.CHECK_VIOLATION,
          constraint: "events_capacity_positive",
        },
      );
    });
  }

  for (const endTime of [
    "2026-10-10T10:00:00+09:00",
    "2026-10-01T10:00:00+09:00",
  ]) {
    it(`開始以前の終了時刻 ${endTime} を保存できない`, async () => {
      const VENUE_ID = "22222222-2222-4222-8222-222222222222";
      const EVENT_ID = "11111111-1111-4111-8111-111111111111";
      const START_TIME = "2026-10-10T10:00:00+09:00";
      const END_TIME = "2026-10-10T11:00:00+09:00";

      await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
        VENUE_ID,
        "催事会場",
      ]);
      await client().query(
        `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
      );

      await assert.rejects(
        () =>
          client().query("UPDATE events SET end_time = $1 WHERE id = $2", [
            endTime,
            EVENT_ID,
          ]),
        {
          code: POSTGRES_ERROR.CHECK_VIOLATION,
          constraint: "events_period_order",
        },
      );
    });
  }

  for (const [status, cancelledAt] of [
    ["reserved", "2026-10-02T10:00:00+09:00"],
    ["cancelled", null],
  ] as const) {
    it(`予約状態 ${status} とキャンセル日時の不整合を拒否する`, async () => {
      const VENUE_ID = "22222222-2222-4222-8222-222222222222";
      const EVENT_ID = "11111111-1111-4111-8111-111111111111";
      const USER_ID = "customer-1";
      const START_TIME = "2026-10-10T10:00:00+09:00";
      const END_TIME = "2026-10-10T11:00:00+09:00";
      const RESERVED_AT = "2026-10-01T10:00:00+09:00";

      await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
        VENUE_ID,
        "催事会場",
      ]);
      await client().query(
        `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
      );

      await assert.rejects(
        () =>
          client().query(
            `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, status, reserved_at, cancelled_at`,
            [randomUUID(), EVENT_ID, USER_ID, status, RESERVED_AT, cancelledAt],
          ),
        {
          code: POSTGRES_ERROR.CHECK_VIOLATION,
          constraint: "reservations_status_cancelled_at",
        },
      );
    });
  }

  it("予約日時より前のキャンセル日時を保存できない", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const USER_ID = "customer-1";
    const START_TIME = "2026-10-10T10:00:00+09:00";
    const END_TIME = "2026-10-10T11:00:00+09:00";
    const RESERVED_AT = "2026-10-01T10:00:00+09:00";

    await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
      VENUE_ID,
      "催事会場",
    ]);
    await client().query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
    );

    await assert.rejects(
      () =>
        client().query(
          `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, status, reserved_at, cancelled_at`,
          [
            randomUUID(),
            EVENT_ID,
            USER_ID,
            "cancelled",
            RESERVED_AT,
            "2026-10-01T09:59:59+09:00",
          ],
        ),
      {
        code: POSTGRES_ERROR.CHECK_VIOLATION,
        constraint: "reservations_cancellation_order",
      },
    );
  });

  it("予約日時と同じ時点のキャンセル日時を保存できる", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const USER_ID = "customer-1";
    const START_TIME = "2026-10-10T10:00:00+09:00";
    const END_TIME = "2026-10-10T11:00:00+09:00";
    const RESERVED_AT = "2026-10-01T10:00:00+09:00";

    await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
      VENUE_ID,
      "催事会場",
    ]);
    await client().query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
    );

    await assert.doesNotReject(() =>
      client().query(
        `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, status, reserved_at, cancelled_at`,
        [
          randomUUID(),
          EVENT_ID,
          USER_ID,
          "cancelled",
          RESERVED_AT,
          RESERVED_AT,
        ],
      ),
    );
  });

  it("定義されていない予約状態を保存できない", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const USER_ID = "customer-1";
    const START_TIME = "2026-10-10T10:00:00+09:00";
    const END_TIME = "2026-10-10T11:00:00+09:00";
    const RESERVED_AT = "2026-10-01T10:00:00+09:00";

    await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
      VENUE_ID,
      "催事会場",
    ]);
    await client().query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
    );

    await assert.rejects(
      () =>
        client().query(
          `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, status, reserved_at, cancelled_at`,
          [randomUUID(), EVENT_ID, USER_ID, "unknown", RESERVED_AT, null],
        ),
      {
        code: POSTGRES_ERROR.INVALID_TEXT_REPRESENTATION,
      },
    );
  });

  it("存在しない会場を参照する催事を保存できない", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const START_TIME = "2026-10-10T10:00:00+09:00";
    const END_TIME = "2026-10-10T11:00:00+09:00";

    await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
      VENUE_ID,
      "催事会場",
    ]);
    await client().query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
    );

    await assert.rejects(
      () =>
        client().query("UPDATE events SET venue_id = $1 WHERE id = $2", [
          randomUUID(),
          EVENT_ID,
        ]),
      { code: POSTGRES_ERROR.FOREIGN_KEY_VIOLATION },
    );
  });

  it("存在しない催事を参照する予約を保存できない", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const USER_ID = "customer-1";
    const START_TIME = "2026-10-10T10:00:00+09:00";
    const END_TIME = "2026-10-10T11:00:00+09:00";
    const RESERVED_AT = "2026-10-01T10:00:00+09:00";

    await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
      VENUE_ID,
      "催事会場",
    ]);
    await client().query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
    );

    await assert.rejects(
      () =>
        client().query(
          `INSERT INTO reservations (id, event_id, user_id, status, reserved_at, cancelled_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, status, reserved_at, cancelled_at`,
          [randomUUID(), randomUUID(), USER_ID, "reserved", RESERVED_AT, null],
        ),
      {
        code: POSTGRES_ERROR.FOREIGN_KEY_VIOLATION,
      },
    );
  });

  it("催事が参照する会場を削除して関連を壊せない", async () => {
    const VENUE_ID = "22222222-2222-4222-8222-222222222222";
    const EVENT_ID = "11111111-1111-4111-8111-111111111111";
    const START_TIME = "2026-10-10T10:00:00+09:00";
    const END_TIME = "2026-10-10T11:00:00+09:00";

    await client().query("INSERT INTO venues (id, name) VALUES ($1, $2)", [
      VENUE_ID,
      "催事会場",
    ]);
    await client().query(
      `INSERT INTO events (id, title, venue_id, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [EVENT_ID, "陶芸ワークショップ", VENUE_ID, START_TIME, END_TIME, 2],
    );

    await assert.rejects(
      () => client().query("DELETE FROM venues WHERE id = $1", [VENUE_ID]),
      {
        code: POSTGRES_ERROR.RESTRICT_VIOLATION,
        constraint: "events_venue_id_fkey",
      },
    );
  });
});
