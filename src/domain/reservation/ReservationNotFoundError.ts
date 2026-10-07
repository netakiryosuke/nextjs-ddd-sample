export class ReservationNotFoundError extends Error {
  constructor() {
    super("The reservation does not exist");
    this.name = "ReservationNotFoundError";
  }
}
