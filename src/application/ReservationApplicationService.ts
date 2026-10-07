import { randomUUID } from "node:crypto";
import type { EventRepository } from "../domain/event/EventRepository";
import type { EventAvailabilityRepository } from "../domain/event/EventAvailabilityRepository";
import { EventNotReservableError } from "../domain/event/EventNotReservableError";
import { DuplicateReservationError } from "../domain/reservation/DuplicateReservationError";
import { Reservation } from "../domain/reservation/Reservation";
import type { ReservationRepository } from "../domain/reservation/ReservationRepository";
import { ReservationStatus } from "../domain/reservation/ReservationStatus";
import { EventNotFoundError } from "../domain/event/EventNotFoundError";
import type { TransactionManager } from "./TransactionManager";
import { ReservationNotFoundError } from "../domain/reservation/ReservationNotFoundError";

export class ReservationApplicationService {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly eventAvailabilityRepository: EventAvailabilityRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async reserve(eventId: string, userId: string): Promise<Reservation> {
    return this.transactionManager.execute(async () => {
      const event = await this.eventRepository.findByIdForUpdate(eventId);

      if (event === null) {
        throw new EventNotFoundError();
      }

      const eventAvailability =
        await this.eventAvailabilityRepository.findById(eventId);

      if (eventAvailability === null) {
        throw new EventNotFoundError();
      }

      if (
        await this.reservationRepository.existsByEventIdAndUserIdAndStatus(
          eventId,
          userId,
          ReservationStatus.RESERVED,
        )
      ) {
        throw new DuplicateReservationError();
      }

      const now = new Date();

      if (!eventAvailability.isReservable(now)) {
        throw new EventNotReservableError();
      }

      const reservation = new Reservation(
        randomUUID(),
        eventId,
        userId,
        ReservationStatus.RESERVED,
        now,
        null,
      );

      return this.reservationRepository.save(reservation);
    });
  }

  async cancel(reservationId: string, userId: string): Promise<Reservation> {
    const reservation =
      await this.reservationRepository.findById(reservationId);

    if (reservation === null) {
      throw new ReservationNotFoundError();
    }

    return this.transactionManager.execute(async () => {
      const event = await this.eventRepository.findByIdForUpdate(
        reservation.eventId,
      );

      if (event === null) {
        throw new EventNotFoundError();
      }

      const currentReservation =
        await this.reservationRepository.findById(reservationId);

      if (currentReservation === null) {
        throw new ReservationNotFoundError();
      }

      const now = new Date();
      event.ensureCancellationAllowed(now);
      const cancelledReservation = currentReservation.cancel(userId, now);

      return this.reservationRepository.save(cancelledReservation);
    });
  }
}
