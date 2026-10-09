import { DomainError } from "../DomainError";

export class VenueNotFoundError extends DomainError {
  constructor() {
    super("会場が見つかりません。");
    this.name = "VenueNotFoundError";
  }
}
