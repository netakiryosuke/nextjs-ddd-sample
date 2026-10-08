import { DomainError } from "../DomainError";

export class ReservationAlreadyCancelledError extends DomainError {
  constructor() {
    super("この予約はすでにキャンセルされています。");
    this.name = "ReservationAlreadyCancelledError";
  }
}
