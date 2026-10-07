export class EventNotFoundError extends Error {
  constructor() {
    super("The event does not exist");
    this.name = "EventNotFoundError";
  }
}
