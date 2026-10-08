import { DomainError } from "../DomainError";

export class EventNotFoundError extends DomainError {
  constructor() {
    super("催事が見つかりません。");
    this.name = "EventNotFoundError";
  }
}
