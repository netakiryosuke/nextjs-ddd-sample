import type { Venue } from "./Venue";

export interface VenueRepository {
  findById(id: string): Promise<Venue | null>;
  findAll(): Promise<Venue[]>;
  save(venue: Venue): Promise<Venue>;
}
