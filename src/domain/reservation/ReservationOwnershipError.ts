export class ReservationOwnershipError extends Error {
  constructor() {
    super("Only the reservation owner can cancel the reservation");
    this.name = "ReservationOwnershipError";
  }
}
