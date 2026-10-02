import { Reservation } from "../domain/reservation/Reservation";
import type { ReservationRepository } from "../domain/reservation/ReservationRepository";
import { ReservationStatus } from "../domain/reservation/ReservationStatus";
import type {
  Prisma,
  Reservation as ReservationRecord,
} from "./generated/prisma/client";

const reservationStatuses = {
  reserved: ReservationStatus.RESERVED,
  cancelled: ReservationStatus.CANCELLED,
} satisfies Record<ReservationRecord["status"], ReservationStatus>;

export class PrismaReservationRepository implements ReservationRepository {
  constructor(private readonly prisma: Prisma.TransactionClient) {}

  async findById(id: string): Promise<Reservation | null> {
    const reservationRecord = await this.prisma.reservation.findUnique({
      where: { id },
    });

    if (reservationRecord === null) {
      return null;
    }

    return new Reservation(
      reservationRecord.id,
      reservationRecord.eventId,
      reservationRecord.userId,
      reservationStatuses[reservationRecord.status],
      reservationRecord.reservedAt,
      reservationRecord.cancelledAt,
    );
  }

  async findByEventIdAndUserIdAndStatus(
    eventId: string,
    userId: string,
    status: ReservationStatus,
  ): Promise<Reservation[]> {
    const reservationRecords = await this.prisma.reservation.findMany({
      where: { eventId, userId, status },
      orderBy: [{ reservedAt: "asc" }, { id: "asc" }],
    });

    return reservationRecords.map((reservationRecord) =>
      new Reservation(
        reservationRecord.id,
        reservationRecord.eventId,
        reservationRecord.userId,
        reservationStatuses[reservationRecord.status],
        reservationRecord.reservedAt,
        reservationRecord.cancelledAt,
      ),
    );
  }

  async existsByEventIdAndUserIdAndStatus(
    eventId: string,
    userId: string,
    status: ReservationStatus,
  ): Promise<boolean> {
    const reservationRecord = await this.prisma.reservation.findFirst({
      where: { eventId, userId, status },
      select: { id: true },
    });

    return reservationRecord !== null;
  }

  async countByEventIdAndStatus(
    eventId: string,
    status: ReservationStatus,
  ): Promise<number> {
    return this.prisma.reservation.count({ where: { eventId, status } });
  }

  async save(reservation: Reservation): Promise<Reservation> {
    const reservationData = {
      eventId: reservation.eventId,
      userId: reservation.userId,
      status: reservation.status,
      reservedAt: reservation.reservedAt,
      cancelledAt: reservation.cancelledAt,
    };

    const reservationRecord = await this.prisma.reservation.upsert({
      where: { id: reservation.id },
      create: { id: reservation.id, ...reservationData },
      update: reservationData,
    });

    return new Reservation(
      reservationRecord.id,
      reservationRecord.eventId,
      reservationRecord.userId,
      reservationStatuses[reservationRecord.status],
      reservationRecord.reservedAt,
      reservationRecord.cancelledAt,
    );
  }
}
