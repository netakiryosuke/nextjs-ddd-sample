import { auth } from "../auth";
import { Event } from "../domain/event/Event";
import type { EventAvailability } from "../domain/event/EventAvailability";
import type { EventAvailabilityRepository } from "../domain/event/EventAvailabilityRepository";
import type { EventRepository } from "../domain/event/EventRepository";
import type { VenueRepository } from "../domain/venue/VenueRepository";
import { VenueNotFoundError } from "../domain/venue/VenueNotFoundError";
import { AccessDeniedError } from "../security/AccessDeniedError";
import { Role } from "../security/Role";

export class EventApplicationService {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly eventAvailabilityRepository: EventAvailabilityRepository,
    private readonly venueRepository: VenueRepository,
  ) {}

  async list(): Promise<Event[]> {
    return this.eventRepository.findAll();
  }

  async lookup(eventId: string): Promise<EventAvailability | null> {
    return this.eventAvailabilityRepository.findById(eventId);
  }

  async create(event: Event): Promise<Event> {
    const session = await auth();

    if (!session?.user.roles.includes(Role.ADMIN)) {
      throw new AccessDeniedError();
    }

    const venue = await this.venueRepository.findById(event.venueId);

    if (!venue) {
      throw new VenueNotFoundError();
    }

    const newEvent = new Event(
      null,
      event.title,
      venue,
      event.period,
      event.capacity,
    );

    return this.eventRepository.save(newEvent);
  }
}
