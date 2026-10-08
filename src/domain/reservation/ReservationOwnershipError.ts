import { DomainError } from "../DomainError";

export class ReservationOwnershipError extends DomainError {
  constructor() {
    super("ご本人の予約のみキャンセルできます。");
    this.name = "ReservationOwnershipError";
  }
}
