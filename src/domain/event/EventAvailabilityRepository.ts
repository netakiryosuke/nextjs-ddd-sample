import type { EventAvailability } from "./EventAvailability";

export interface EventAvailabilityRepository {
  findById(id: string): Promise<EventAvailability | null>;
  findAll(): Promise<EventAvailability[]>;
}
