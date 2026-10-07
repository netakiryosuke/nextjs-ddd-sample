export class EventNotReservableError extends Error {
  constructor() {
    super("The event is full or has already started");
    this.name = "EventNotReservableError";
  }
}
