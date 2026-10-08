import { DomainError } from "../DomainError";

export class EventCancellationNotAllowedError extends DomainError {
  constructor() {
    super("開始時刻を過ぎたためキャンセルできません。");
    this.name = "EventCancellationNotAllowedError";
  }
}
