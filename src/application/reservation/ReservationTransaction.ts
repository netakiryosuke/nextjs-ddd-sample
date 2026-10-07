import type { EventRepository } from "../../domain/event/EventRepository";
import type { EventAvailabilityRepository } from "../../domain/event/EventAvailabilityRepository";
import type { ReservationRepository } from "../../domain/reservation/ReservationRepository";

export interface ReservationTransaction {
  execute<T>(
    eventId: string,
    operation: (
      eventRepository: EventRepository,
      reservationRepository: ReservationRepository,
      eventAvailabilityRepository: EventAvailabilityRepository,
    ) => Promise<T>,
  ): Promise<T>;
}
