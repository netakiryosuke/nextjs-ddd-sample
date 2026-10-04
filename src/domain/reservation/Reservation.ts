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
  private readonly reservationTime: Date;
  private cancellationTime: Date | null;

  constructor(
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
    this.reservationTime = new Date(parsed.reservedAt.getTime());
    this.cancellationTime =
      parsed.cancelledAt === null ? null : new Date(parsed.cancelledAt.getTime());

    if (
      (this.currentStatus === ReservationStatus.RESERVED &&
        this.cancellationTime !== null) ||
      (this.currentStatus === ReservationStatus.CANCELLED &&
        this.cancellationTime === null)
    ) {
      throw new RangeError("Reservation status and cancellation date must agree");
    }

    if (
      this.cancellationTime !== null &&
      this.cancellationTime.getTime() < this.reservationTime.getTime()
    ) {
      throw new RangeError("Cancellation date cannot precede reservation date");
    }
  }

  get status(): ReservationStatus {
    return this.currentStatus;
  }

  get reservedAt(): Date {
    return new Date(this.reservationTime.getTime());
  }

  get cancelledAt(): Date | null {
    return this.cancellationTime === null
      ? null
      : new Date(this.cancellationTime.getTime());
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

    const cancellationTime = z.date().parse(now);

    if (cancellationTime.getTime() < this.reservationTime.getTime()) {
      throw new RangeError("Cancellation date cannot precede reservation date");
    }

    this.cancellationTime = new Date(cancellationTime.getTime());
    this.currentStatus = ReservationStatus.CANCELLED;
  }
}
