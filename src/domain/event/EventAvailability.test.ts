import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { Venue } from "../venue/Venue";
import { Event } from "./Event";
import { EventAvailability } from "./EventAvailability";
import { EventPeriod } from "./EventPeriod";

const START_TIME = "2026-10-10T10:00:00+09:00";
const BEFORE_START = "2026-10-10T09:59:59.999+09:00";

function createAvailability(reservationCount: number): EventAvailability {
  const event = new Event(
    "11111111-1111-4111-8111-111111111111",
    "陶芸ワークショップ",
    new Venue("22222222-2222-4222-8222-222222222222", "催事会場"),
    new EventPeriod(
      new Date(START_TIME),
      new Date("2026-10-10T11:00:00+09:00"),
    ),
    2,
  );

  return new EventAvailability(event, reservationCount);
}

describe("EventAvailability", () => {
  it("予約がなければ定員分の残席がある", () => {
    const availability = createAvailability(0);

    assert.equal(availability.remainingSeats(), 2);
    assert.equal(availability.isFull(), false);
    assert.equal(availability.isReservable(new Date(BEFORE_START)), true);
  });

  it("最後の1席があれば開始前に予約できる", () => {
    const availability = createAvailability(1);

    assert.equal(availability.remainingSeats(), 1);
    assert.equal(availability.isFull(), false);
    assert.equal(availability.isReservable(new Date(BEFORE_START)), true);
  });

  it("定員に達したら開始前でも予約できない", () => {
    const availability = createAvailability(2);

    assert.equal(availability.remainingSeats(), 0);
    assert.equal(availability.isFull(), true);
    assert.equal(availability.isReservable(new Date(BEFORE_START)), false);
  });

  it("予約数が定員を超えている場合も空席があるとは扱わない", () => {
    const availability = createAvailability(3);

    assert.equal(availability.remainingSeats(), 0);
    assert.equal(availability.isFull(), true);
    assert.equal(availability.isReservable(new Date(BEFORE_START)), false);
  });

  for (const offset of [0, 1]) {
    it(`空席があっても開始時刻から${offset}ms後は予約できない`, () => {
      const availability = createAvailability(0);
      const now = new Date(new Date(START_TIME).getTime() + offset);

      assert.equal(availability.isReservable(now), false);
    });
  }

  for (const count of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    it(`予約数に不正な値 ${count} を指定できない`, () => {
      assert.throws(() => createAvailability(count), ZodError);
    });
  }

  it("満席でも無効な現在時刻を予約可否の判定に使えない", () => {
    assert.throws(
      () => createAvailability(2).isReservable(new Date(NaN)),
      ZodError,
    );
  });
});
