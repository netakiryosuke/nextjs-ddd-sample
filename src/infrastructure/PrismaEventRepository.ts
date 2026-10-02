import { Event } from "../domain/event/Event";
import { EventPeriod } from "../domain/event/EventPeriod";
import type { EventRepository } from "../domain/event/EventRepository";
import { Venue } from "../domain/venue/Venue";
import { EventDao } from "./dao/EventDao";
import type { Prisma } from "./generated/prisma/client";

export class PrismaEventRepository implements EventRepository {
  constructor(
    private readonly prisma: Prisma.TransactionClient,
    private readonly eventDao: EventDao,
  ) {}

  async findById(id: string): Promise<Event | null> {
    const eventDto = await this.eventDao.selectById(id);
    if (eventDto === null) {
      return null;
    }
    return new Event(
      eventDto.id,
      eventDto.title,
      new Venue(eventDto.venue_id, eventDto.venue_name),
      new EventPeriod(eventDto.start_time, eventDto.end_time),
      eventDto.capacity,
    );
  }

  async findAll(): Promise<Event[]> {
    const eventDtos = await this.eventDao.selectAll();
    return eventDtos.map(
      (eventDto) =>
        new Event(
          eventDto.id,
          eventDto.title,
          new Venue(eventDto.venue_id, eventDto.venue_name),
          new EventPeriod(eventDto.start_time, eventDto.end_time),
          eventDto.capacity,
        ),
    );
  }

  async save(event: Event): Promise<Event> {
    const eventData = {
      title: event.title,
      venueId: event.venueId,
      startTime: event.period.startTime,
      endTime: event.period.endTime,
      capacity: event.capacity,
    };
    const eventRecord = await this.prisma.event.upsert({
      where: { id: event.id },
      create: { id: event.id, ...eventData },
      update: eventData,
      include: { venue: true },
    });
    return new Event(
      eventRecord.id,
      eventRecord.title,
      new Venue(eventRecord.venue.id, eventRecord.venue.name),
      new EventPeriod(eventRecord.startTime, eventRecord.endTime),
      eventRecord.capacity,
    );
  }
}
