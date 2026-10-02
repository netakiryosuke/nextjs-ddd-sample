import { Event } from "../domain/event/Event";
import { EventAvailability } from "../domain/event/EventAvailability";
import type { EventAvailabilityRepository } from "../domain/event/EventAvailabilityRepository";
import { EventPeriod } from "../domain/event/EventPeriod";
import { Venue } from "../domain/venue/Venue";
import { EventAvailabilityDao } from "./dao/EventAvailabilityDao";

export class PrismaEventAvailabilityRepository
  implements EventAvailabilityRepository
{
  constructor(private readonly eventAvailabilityDao: EventAvailabilityDao) {}

  async findById(id: string): Promise<EventAvailability | null> {
    const eventAvailabilityDto = await this.eventAvailabilityDao.selectById(id);

    if (eventAvailabilityDto === null) {
      return null;
    }

    const event = new Event(
      eventAvailabilityDto.id,
      eventAvailabilityDto.title,
      new Venue(eventAvailabilityDto.venue_id, eventAvailabilityDto.venue_name),
      new EventPeriod(
        eventAvailabilityDto.start_time,
        eventAvailabilityDto.end_time,
      ),
      eventAvailabilityDto.capacity,
    );

    return new EventAvailability(event, eventAvailabilityDto.reservation_count);
  }

  async findAll(): Promise<EventAvailability[]> {
    const eventAvailabilityDtos = await this.eventAvailabilityDao.selectAll();

    return eventAvailabilityDtos.map((eventAvailabilityDto) => {
      const event = new Event(
        eventAvailabilityDto.id,
        eventAvailabilityDto.title,
        new Venue(
          eventAvailabilityDto.venue_id,
          eventAvailabilityDto.venue_name,
        ),
        new EventPeriod(
          eventAvailabilityDto.start_time,
          eventAvailabilityDto.end_time,
        ),
        eventAvailabilityDto.capacity,
      );

      return new EventAvailability(
        event,
        eventAvailabilityDto.reservation_count,
      );
    });
  }
}
