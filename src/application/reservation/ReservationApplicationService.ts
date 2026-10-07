import { randomUUID } from "node:crypto";
import { EventNotFoundError } from "../event/EventNotFoundError";
import { EventNotReservableError } from "../../domain/event/EventNotReservableError";
import { DuplicateReservationError } from "../../domain/reservation/DuplicateReservationError";
import { Reservation } from "../../domain/reservation/Reservation";
import type { ReservationRepository } from "../../domain/reservation/ReservationRepository";
import { ReservationStatus } from "../../domain/reservation/ReservationStatus";
import { ReservationNotFoundError } from "./ReservationNotFoundError";
import type { ReservationTransactionManager } from "./ReservationTransactionManager";

export class ReservationApplicationService {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly reservationTransactionManager: ReservationTransactionManager,
  ) {}

  async reserve(eventId: string, userId: string): Promise<Reservation> {
    return this.reservationTransactionManager.execute(
      eventId,
      async (
        _eventRepository,
        reservationRepository,
        eventAvailabilityRepository,
      ) => {
        const eventAvailability =
          await eventAvailabilityRepository.findById(eventId);

        if (eventAvailability === null) {
          throw new EventNotFoundError();
        }

        if (
          await reservationRepository.existsByEventIdAndUserIdAndStatus(
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

        return reservationRepository.save(reservation);
      },
    );
  }

  async cancel(reservationId: string, userId: string): Promise<Reservation> {
    const reservation =
      await this.reservationRepository.findById(reservationId);

    if (reservation === null) {
      throw new ReservationNotFoundError();
    }

    return this.reservationTransactionManager.execute(
      reservation.eventId,
      async (eventRepository, reservationRepository) => {
        const currentReservation =
          await reservationRepository.findById(reservationId);

        if (currentReservation === null) {
          throw new ReservationNotFoundError();
        }

        const event = await eventRepository.findById(
          currentReservation.eventId,
        );

        if (event === null) {
          throw new EventNotFoundError();
        }

        const now = new Date();
        event.ensureCancellationAllowed(now);
        const cancelledReservation = currentReservation.cancel(userId, now);

        return reservationRepository.save(cancelledReservation);
      },
    );
  }
}
