import { z } from "zod";
import { Venue } from "../venue/Venue";
import { EventCancellationNotAllowedError } from "./EventCancellationNotAllowedError";
import { EventPeriod } from "./EventPeriod";

const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  venue: z.instanceof(Venue),
  period: z.instanceof(EventPeriod),
  capacity: z.number().int().positive(),
});

export class Event {
  public readonly id: string;
  public readonly title: string;
  public readonly venue: Venue;
  public readonly period: EventPeriod;
  public readonly capacity: number;

  constructor(
    id: string,
    title: string,
    venue: Venue,
    period: EventPeriod,
    capacity: number,
  ) {
    const parsed = eventSchema.parse({ id, title, venue, period, capacity });
    this.id = parsed.id;
    this.title = parsed.title;
    this.venue = parsed.venue;
    this.period = parsed.period;
    this.capacity = parsed.capacity;
  }

  get venueId(): string {
    return this.venue.id;
  }

  get venueName(): string {
    return this.venue.name;
  }

  hasStarted(now: Date): boolean {
    return this.period.hasStarted(now);
  }

  ensureCancellationAllowed(now: Date): void {
    if (this.hasStarted(now)) {
      throw new EventCancellationNotAllowedError();
    }
  }
}
