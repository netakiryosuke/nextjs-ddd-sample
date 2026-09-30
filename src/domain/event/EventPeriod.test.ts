import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { EventPeriod } from "./EventPeriod";

const START_TIME = "2026-10-10T10:00:00+09:00";
const END_TIME = "2026-10-10T11:00:00+09:00";

describe("EventPeriod", () => {
  it("開始時刻ちょうどから開始済みと判定する", () => {
    const startTime = new Date(START_TIME);
    const period = new EventPeriod(startTime, new Date(END_TIME));

    assert.equal(period.hasStarted(new Date(startTime.getTime() - 1)), false);
    assert.equal(period.hasStarted(startTime), true);
    assert.equal(period.hasStarted(new Date(startTime.getTime() + 1)), true);
  });

  it("開始と終了が同時または逆順の期間を作れない", () => {
    const startTime = new Date(START_TIME);

    assert.throws(() => new EventPeriod(startTime, startTime), RangeError);
    assert.throws(
      () => new EventPeriod(new Date(END_TIME), startTime),
      RangeError,
    );
  });

  it("無効な日時を持つ期間を作れない", () => {
    assert.throws(
      () => new EventPeriod(new Date(NaN), new Date(END_TIME)),
      ZodError,
    );
    assert.throws(
      () => new EventPeriod(new Date(START_TIME), new Date(NaN)),
      ZodError,
    );
  });

  it("無効な現在時刻で開始済みかを判定できない", () => {
    const period = new EventPeriod(new Date(START_TIME), new Date(END_TIME));

    assert.throws(() => period.hasStarted(new Date(NaN)), ZodError);
  });

  it("開始・終了が両方不正なら、両フィールドの検証エラーをまとめて取得できる", () => {
    assert.throws(
      () => new EventPeriod(new Date(NaN), new Date(NaN)),
      (error: unknown) => {
        assert.ok(error instanceof ZodError);
        assert.deepEqual(
          error.issues.map((issue) => issue.path),
          [["startTime"], ["endTime"]],
        );
        return true;
      },
    );
  });

  it("タイムゾーン表記が違っても同じ時点の期間は等しい", () => {
    const period = new EventPeriod(new Date(START_TIME), new Date(END_TIME));
    const samePeriod = new EventPeriod(
      new Date("2026-10-10T01:00:00Z"),
      new Date("2026-10-10T02:00:00Z"),
    );
    const differentPeriod = new EventPeriod(
      new Date(START_TIME),
      new Date("2026-10-10T12:00:00+09:00"),
    );

    assert.equal(period.equals(samePeriod), true);
    assert.equal(period.equals(differentPeriod), false);
  });

  it("渡した日時や取得した日時を書き換えても期間が変わらない", () => {
    const startTime = new Date(START_TIME);
    const endTime = new Date(END_TIME);
    const period = new EventPeriod(startTime, endTime);

    startTime.setUTCFullYear(2000);
    endTime.setUTCFullYear(2000);
    period.startTime.setUTCFullYear(2000);
    period.endTime.setUTCFullYear(2000);

    assert.equal(period.startTime.getTime(), new Date(START_TIME).getTime());
    assert.equal(period.endTime.getTime(), new Date(END_TIME).getTime());
    assert.equal(period.hasStarted(new Date("2026-10-10T09:59:59+09:00")), false);
  });
});
