import { z } from "zod";
import { ReservationStatus } from "./ReservationStatus";

const reservationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  status: z.enum(ReservationStatus),
  reservedAt: z.date(),
  cancelledAt: z.date().nullable(),
});

export class Reservation {
  public readonly id: string;
  public readonly eventId: string;
  public readonly userId: string;
  private currentStatus: ReservationStatus;
  private readonly reservedTimestamp: number;
  private cancelledTimestamp: number | null;

  private constructor(
    id: string,
    eventId: string,
    userId: string,
    status: ReservationStatus,
    reservedAt: Date,
    cancelledAt: Date | null,
  ) {
    const parsed = reservationSchema.parse({
      id,
      eventId,
      userId,
      status,
      reservedAt,
      cancelledAt,
    });
    this.id = parsed.id;
    this.eventId = parsed.eventId;
    this.userId = parsed.userId;
    this.currentStatus = parsed.status;
    this.reservedTimestamp = parsed.reservedAt.getTime();
    this.cancelledTimestamp =
      parsed.cancelledAt === null ? null : parsed.cancelledAt.getTime();

    if (
      (this.currentStatus === ReservationStatus.RESERVED &&
        this.cancelledTimestamp !== null) ||
      (this.currentStatus === ReservationStatus.CANCELLED &&
        this.cancelledTimestamp === null)
    ) {
      throw new RangeError("Reservation status and cancellation date must agree");
    }

    if (
      this.cancelledTimestamp !== null &&
      this.cancelledTimestamp < this.reservedTimestamp
    ) {
      throw new RangeError("Cancellation date cannot precede reservation date");
    }
  }

  static create(
    id: string,
    eventId: string,
    userId: string,
    reservedAt: Date,
  ): Reservation {
    return new Reservation(
      id,
      eventId,
      userId,
      ReservationStatus.RESERVED,
      reservedAt,
      null,
    );
  }

  static reconstruct(
    id: string,
    eventId: string,
    userId: string,
    status: ReservationStatus,
    reservedAt: Date,
    cancelledAt: Date | null,
  ): Reservation {
    return new Reservation(id, eventId, userId, status, reservedAt, cancelledAt);
  }

  get status(): ReservationStatus {
    return this.currentStatus;
  }

  get reservedAt(): Date {
    return new Date(this.reservedTimestamp);
  }

  get cancelledAt(): Date | null {
    return this.cancelledTimestamp === null
      ? null
      : new Date(this.cancelledTimestamp);
  }

  isActive(): boolean {
    return this.currentStatus === ReservationStatus.RESERVED;
  }

  cancel(actorId: string, now: Date): void {
    if (actorId !== this.userId) {
      throw new Error(
        "Only the reservation owner can cancel the reservation",
      );
    }

    if (!this.isActive()) {
      throw new Error("The reservation is already cancelled");
    }

    const cancelledTimestamp = z.date().parse(now).getTime();

    if (cancelledTimestamp < this.reservedTimestamp) {
      throw new RangeError("Cancellation date cannot precede reservation date");
    }

    this.cancelledTimestamp = cancelledTimestamp;
    this.currentStatus = ReservationStatus.CANCELLED;
  }
}
