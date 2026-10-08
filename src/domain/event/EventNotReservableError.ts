import { DomainError } from "../DomainError";

export class EventNotReservableError extends DomainError {
  constructor() {
    super("満席、または開始時刻を過ぎたため予約できません。");
    this.name = "EventNotReservableError";
  }
}
