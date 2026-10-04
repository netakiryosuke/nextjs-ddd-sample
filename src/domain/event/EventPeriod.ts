import { z } from "zod";

const eventPeriodSchema = z.object({
  startTime: z.date(),
  endTime: z.date(),
});

export class EventPeriod {
  private readonly startDateTime: Date;
  private readonly endDateTime: Date;

  constructor(startTime: Date, endTime: Date) {
    const parsed = eventPeriodSchema.parse({ startTime, endTime });

    this.startDateTime = new Date(parsed.startTime.getTime());
    this.endDateTime = new Date(parsed.endTime.getTime());

    if (this.startDateTime.getTime() >= this.endDateTime.getTime()) {
      throw new RangeError("Event start time must be before end time");
    }
  }

  get startTime(): Date {
    return new Date(this.startDateTime.getTime());
  }

  get endTime(): Date {
    return new Date(this.endDateTime.getTime());
  }

  hasStarted(now: Date): boolean {
    return z.date().parse(now).getTime() >= this.startDateTime.getTime();
  }

  equals(other: EventPeriod): boolean {
    return (
      this.startDateTime.getTime() === other.startDateTime.getTime() &&
      this.endDateTime.getTime() === other.endDateTime.getTime()
    );
  }
}
