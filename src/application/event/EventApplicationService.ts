import type { Event } from "../../domain/event/Event";
import type { EventAvailability } from "../../domain/event/EventAvailability";
import type { EventAvailabilityRepository } from "../../domain/event/EventAvailabilityRepository";
import type { EventRepository } from "../../domain/event/EventRepository";

export class EventApplicationService {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly eventAvailabilityRepository: EventAvailabilityRepository,
  ) {}

  async list(): Promise<Event[]> {
    return this.eventRepository.findAll();
  }

  async lookup(eventId: string): Promise<EventAvailability | null> {
    return this.eventAvailabilityRepository.findById(eventId);
  }
}
