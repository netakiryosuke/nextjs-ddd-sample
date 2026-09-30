import type { Reservation } from "./Reservation";
import type { ReservationStatus } from "./ReservationStatus";

export interface ReservationRepository {
  findById(id: string): Promise<Reservation | null>;
  findByEventIdAndUserIdAndStatus(
    eventId: string,
    userId: string,
    status: ReservationStatus,
  ): Promise<Reservation[]>;
  existsByEventIdAndUserIdAndStatus(
    eventId: string,
    userId: string,
    status: ReservationStatus,
  ): Promise<boolean>;
  countByEventIdAndStatus(
    eventId: string,
    status: ReservationStatus,
  ): Promise<number>;
  save(reservation: Reservation): Promise<Reservation>;
}
