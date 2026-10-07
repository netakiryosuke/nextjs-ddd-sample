export class EventCancellationNotAllowedError extends Error {
  constructor() {
    super("Reservations cannot be cancelled after the event starts");
    this.name = "EventCancellationNotAllowedError";
  }
}
