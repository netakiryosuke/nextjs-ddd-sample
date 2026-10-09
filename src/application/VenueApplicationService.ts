import type { Venue } from "../domain/venue/Venue";
import type { VenueRepository } from "../domain/venue/VenueRepository";

export class VenueApplicationService {
  constructor(private readonly venueRepository: VenueRepository) {}

  async list(): Promise<Venue[]> {
    return this.venueRepository.findAll();
  }
}
