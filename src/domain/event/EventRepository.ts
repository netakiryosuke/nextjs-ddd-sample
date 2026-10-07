import type { Event } from "./Event";

export interface EventRepository {
  findById(id: string): Promise<Event | null>;
  findByIdForUpdate(id: string): Promise<Event | null>;
  findAll(): Promise<Event[]>;
  save(event: Event): Promise<Event>;
}
