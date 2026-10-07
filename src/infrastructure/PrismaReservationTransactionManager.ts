import type { ReservationTransactionManager } from "../application/reservation/ReservationTransactionManager";
import type { EventRepository } from "../domain/event/EventRepository";
import type { EventAvailabilityRepository } from "../domain/event/EventAvailabilityRepository";
import type { ReservationRepository } from "../domain/reservation/ReservationRepository";
import { EventAvailabilityDao } from "./dao/EventAvailabilityDao";
import { EventDao } from "./dao/EventDao";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { PrismaEventAvailabilityRepository } from "./PrismaEventAvailabilityRepository";
import { PrismaEventRepository } from "./PrismaEventRepository";
import { PrismaReservationRepository } from "./PrismaReservationRepository";

export class PrismaReservationTransactionManager implements ReservationTransactionManager {
  constructor(private readonly prisma: PrismaClient) {}

  async execute<T>(
    eventId: string,
    operation: (
      eventRepository: EventRepository,
      reservationRepository: ReservationRepository,
      eventAvailabilityRepository: EventAvailabilityRepository,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`
          SELECT id FROM events WHERE id = ${eventId} FOR UPDATE
        `);

        return operation(
          new PrismaEventRepository(transaction, new EventDao(transaction)),
          new PrismaReservationRepository(transaction),
          new PrismaEventAvailabilityRepository(
            new EventAvailabilityDao(transaction),
          ),
        );
      },
      {
        // ロック待ち中のコミットを後続の読み取りに反映する。
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}
