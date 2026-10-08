import { DomainError } from "../DomainError";

export class ReservationNotFoundError extends DomainError {
  constructor() {
    super("予約が見つかりません。");
    this.name = "ReservationNotFoundError";
  }
}
