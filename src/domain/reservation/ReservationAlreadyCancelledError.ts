export class ReservationAlreadyCancelledError extends Error {
  constructor() {
    super("The reservation is already cancelled");
    this.name = "ReservationAlreadyCancelledError";
  }
}
