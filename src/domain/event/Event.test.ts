import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { Venue } from "../venue/Venue";
import { Event } from "./Event";
import { EventCancellationNotAllowedError } from "./EventCancellationNotAllowedError";
import { EventPeriod } from "./EventPeriod";

const START_TIME = "2026-10-10T10:00:00+09:00";

function createEvent(capacity = 10): Event {
  return new Event(
    "11111111-1111-4111-8111-111111111111",
    "陶芸ワークショップ",
    new Venue("22222222-2222-4222-8222-222222222222", "催事会場"),
    new EventPeriod(
      new Date(START_TIME),
      new Date("2026-10-10T11:00:00+09:00"),
    ),
    capacity,
  );
}

describe("Event", () => {
  it("最小の定員は1人である", () => {
    assert.doesNotThrow(() => createEvent(1));
  });

  for (const capacity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    it(`定員に不正な値 ${capacity} を指定できない`, () => {
      assert.throws(() => createEvent(capacity), ZodError);
    });
  }

  it("開始時刻の直前ならキャンセルの受付を許可する", () => {
    const event = createEvent();
    const beforeStart = new Date(new Date(START_TIME).getTime() - 1);

    assert.doesNotThrow(() => event.ensureCancellationAllowed(beforeStart));
  });

  for (const offset of [0, 1]) {
    it(`開始時刻から${offset}ms後はキャンセルの受付を拒否する`, () => {
      const event = createEvent();
      const now = new Date(new Date(START_TIME).getTime() + offset);

      assert.throws(
        () => event.ensureCancellationAllowed(now),
        EventCancellationNotAllowedError,
      );
    });
  }
});
