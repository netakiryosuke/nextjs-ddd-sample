export class DuplicateReservationError extends Error {
  constructor() {
    super("The user already has an active reservation for this event");
    this.name = "DuplicateReservationError";
  }
}
