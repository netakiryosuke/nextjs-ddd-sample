import { DomainError } from "../DomainError";

export class InvalidEventPeriodError extends DomainError {
  constructor() {
    super("終了日時は開始日時より後にしてください。");
    this.name = "InvalidEventPeriodError";
  }
}
