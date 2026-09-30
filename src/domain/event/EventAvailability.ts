import { z } from "zod";
import { Event } from "./Event";

const MIN_RESERVATION_COUNT = 0;

const eventAvailabilitySchema = z.object({
  event: z.instanceof(Event),
  reservationCount: z.number().int().nonnegative(),
});

export class EventAvailability {
  public readonly event: Event;
  public readonly reservationCount: number;

  constructor(event: Event, reservationCount: number) {
    const parsed = eventAvailabilitySchema.parse({ event, reservationCount });
    this.event = parsed.event;
    this.reservationCount = parsed.reservationCount;
  }

  get id(): string {
    return this.event.id;
  }

  remainingSeats(): number {
    return Math.max(
      MIN_RESERVATION_COUNT,
      this.event.capacity - this.reservationCount,
    );
  }

  isFull(): boolean {
    return this.reservationCount >= this.event.capacity;
  }

  isReservable(now: Date): boolean {
    return !this.event.hasStarted(now) && !this.isFull();
  }
}
