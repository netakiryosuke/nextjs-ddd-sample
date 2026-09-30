import { z } from "zod";

const eventPeriodSchema = z.object({
  startTime: z.date(),
  endTime: z.date(),
});

export class EventPeriod {
  private readonly startTimestamp: number;
  private readonly endTimestamp: number;

  constructor(startTime: Date, endTime: Date) {
    const parsed = eventPeriodSchema.parse({ startTime, endTime });
    this.startTimestamp = parsed.startTime.getTime();
    this.endTimestamp = parsed.endTime.getTime();

    if (this.startTimestamp >= this.endTimestamp) {
      throw new RangeError("Event start time must be before end time");
    }
  }

  get startTime(): Date {
    return new Date(this.startTimestamp);
  }

  get endTime(): Date {
    return new Date(this.endTimestamp);
  }

  hasStarted(now: Date): boolean {
    return z.date().parse(now).getTime() >= this.startTimestamp;
  }

  equals(other: EventPeriod): boolean {
    return (
      this.startTimestamp === other.startTimestamp &&
      this.endTimestamp === other.endTimestamp
    );
  }
}
