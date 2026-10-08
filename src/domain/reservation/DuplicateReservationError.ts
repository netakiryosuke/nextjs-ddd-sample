import { DomainError } from "../DomainError";

export class DuplicateReservationError extends DomainError {
  constructor() {
    super("この催事はすでに予約しています。");
    this.name = "DuplicateReservationError";
  }
}
