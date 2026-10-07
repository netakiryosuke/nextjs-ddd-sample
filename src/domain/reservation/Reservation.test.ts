import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { Reservation } from "./Reservation";
import { ReservationOwnershipError } from "./ReservationOwnershipError";
import { ReservationAlreadyCancelledError } from "./ReservationAlreadyCancelledError";
import { ReservationStatus } from "./ReservationStatus";

const RESERVATION_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "customer-1";
const RESERVED_AT = "2026-10-01T10:00:00+09:00";
const CANCELLED_AT = "2026-10-02T10:00:00+09:00";

function createReservation(): Reservation {
  return new Reservation(
    RESERVATION_ID,
    EVENT_ID,
    OWNER_ID,
    ReservationStatus.RESERVED,
    new Date(RESERVED_AT),
    null,
  );
}

describe("Reservation", () => {
  it("新しい予約は席を確保する有効な状態で成立する", () => {
    const reservation = createReservation();

    assert.equal(reservation.status, ReservationStatus.RESERVED);
    assert.equal(reservation.isActive(), true);
    assert.equal(reservation.cancelledAt, null);
  });

  it("本人のキャンセルで席の確保を解除し、記録とキャンセル日時を残す", () => {
    const reservation = createReservation();

    reservation.cancel(OWNER_ID, new Date(CANCELLED_AT));

    assert.equal(reservation.id, RESERVATION_ID);
    assert.equal(reservation.status, ReservationStatus.CANCELLED);
    assert.equal(reservation.isActive(), false);
    assert.equal(
      reservation.cancelledAt?.getTime(),
      new Date(CANCELLED_AT).getTime(),
    );
    assert.equal(
      reservation.reservedAt.getTime(),
      new Date(RESERVED_AT).getTime(),
    );
  });

  it("本人以外がキャンセルしても予約状態を変更しない", () => {
    const reservation = createReservation();

    assert.throws(
      () => reservation.cancel("customer-2", new Date(CANCELLED_AT)),
      ReservationOwnershipError,
    );
    assert.equal(reservation.isActive(), true);
    assert.equal(reservation.cancelledAt, null);
  });

  it("再度キャンセルすると拒否され、元のキャンセル日時を維持する", () => {
    const reservation = createReservation();
    reservation.cancel(OWNER_ID, new Date(CANCELLED_AT));

    assert.throws(
      () => reservation.cancel(OWNER_ID, new Date("2026-10-03T10:00:00+09:00")),
      ReservationAlreadyCancelledError,
    );
    assert.equal(
      reservation.cancelledAt?.getTime(),
      new Date(CANCELLED_AT).getTime(),
    );
  });

  it("予約時刻と同じ時点でキャンセルできる", () => {
    const reservation = createReservation();

    reservation.cancel(OWNER_ID, new Date(RESERVED_AT));

    assert.equal(reservation.isActive(), false);
  });

  for (const { now, expectedError } of [
    { now: new Date("2026-10-01T09:59:59+09:00"), expectedError: RangeError },
    { now: new Date(NaN), expectedError: ZodError },
  ]) {
    it(`不正なキャンセル日時 ${now} では状態を変更しない`, () => {
      const reservation = createReservation();

      assert.throws(() => reservation.cancel(OWNER_ID, now), expectedError);
      assert.equal(reservation.isActive(), true);
      assert.equal(reservation.cancelledAt, null);
    });
  }

  it("キャンセル済みの予約を復元しても有効な予約に戻らない", () => {
    const reservation = new Reservation(
      RESERVATION_ID,
      EVENT_ID,
      OWNER_ID,
      ReservationStatus.CANCELLED,
      new Date(RESERVED_AT),
      new Date(CANCELLED_AT),
    );

    assert.equal(reservation.isActive(), false);
    assert.throws(
      () => reservation.cancel(OWNER_ID, new Date(CANCELLED_AT)),
      ReservationAlreadyCancelledError,
    );
  });

  const invalidStates = [
    {
      status: ReservationStatus.RESERVED,
      cancelledAt: new Date(CANCELLED_AT),
      expectedError: RangeError,
    },
    {
      status: ReservationStatus.CANCELLED,
      cancelledAt: null,
      expectedError: RangeError,
    },
    {
      status: "unknown" as ReservationStatus,
      cancelledAt: null,
      expectedError: ZodError,
    },
    {
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date("2026-10-01T09:59:59+09:00"),
      expectedError: RangeError,
    },
    {
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(NaN),
      expectedError: ZodError,
    },
  ];

  for (const { status, cancelledAt, expectedError } of invalidStates) {
    it(`状態 ${status} と日時 ${cancelledAt} の不整合な予約を復元できない`, () => {
      assert.throws(
        () =>
          new Reservation(
            RESERVATION_ID,
            EVENT_ID,
            OWNER_ID,
            status,
            new Date(RESERVED_AT),
            cancelledAt,
          ),
        expectedError,
      );
    });
  }

  it("無効な日時で予約を作成・復元できない", () => {
    assert.throws(
      () =>
        new Reservation(
          RESERVATION_ID,
          EVENT_ID,
          OWNER_ID,
          ReservationStatus.RESERVED,
          new Date(NaN),
          null,
        ),
      ZodError,
    );
    assert.throws(
      () =>
        new Reservation(
          RESERVATION_ID,
          EVENT_ID,
          OWNER_ID,
          ReservationStatus.RESERVED,
          new Date(NaN),
          null,
        ),
      ZodError,
    );
  });

  it("作成・キャンセルに渡した日時や取得した日時で記録を書き換えられない", () => {
    const reservedAt = new Date(RESERVED_AT);
    const cancelledAt = new Date(CANCELLED_AT);
    const reservation = new Reservation(
      RESERVATION_ID,
      EVENT_ID,
      OWNER_ID,
      ReservationStatus.RESERVED,
      reservedAt,
      null,
    );

    reservation.cancel(OWNER_ID, cancelledAt);
    reservedAt.setUTCFullYear(2000);
    cancelledAt.setUTCFullYear(2000);
    reservation.reservedAt.setUTCFullYear(2000);
    reservation.cancelledAt?.setUTCFullYear(2000);

    assert.equal(
      reservation.reservedAt.getTime(),
      new Date(RESERVED_AT).getTime(),
    );
    assert.equal(
      reservation.cancelledAt?.getTime(),
      new Date(CANCELLED_AT).getTime(),
    );
  });

  it("復元に渡した日時を書き換えても予約記録は変わらない", () => {
    const reservedAt = new Date(RESERVED_AT);
    const cancelledAt = new Date(CANCELLED_AT);
    const reservation = new Reservation(
      RESERVATION_ID,
      EVENT_ID,
      OWNER_ID,
      ReservationStatus.CANCELLED,
      reservedAt,
      cancelledAt,
    );

    reservedAt.setUTCFullYear(2000);
    cancelledAt.setUTCFullYear(2000);

    assert.equal(
      reservation.reservedAt.getTime(),
      new Date(RESERVED_AT).getTime(),
    );
    assert.equal(
      reservation.cancelledAt?.getTime(),
      new Date(CANCELLED_AT).getTime(),
    );
  });
});
