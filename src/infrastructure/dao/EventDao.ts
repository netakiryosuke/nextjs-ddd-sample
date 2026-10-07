import type { EventDto } from "../dto/EventDto";
import { Prisma } from "../generated/prisma/client";

export class EventDao {
  constructor(private readonly prisma: Prisma.TransactionClient) {}

  async selectById(id: string): Promise<EventDto | null> {
    const eventDtos = await this.prisma.$queryRaw<EventDto[]>(Prisma.sql`
      SELECT e.id, e.title, e.venue_id, v.name AS venue_name,
             e.start_time, e.end_time, e.capacity
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      WHERE e.id = ${id}
    `);
    return eventDtos[0] ?? null;
  }

  async selectByIdForUpdate(id: string): Promise<EventDto | null> {
    const eventDtos = await this.prisma.$queryRaw<EventDto[]>(Prisma.sql`
      SELECT e.id, e.title, e.venue_id, v.name AS venue_name,
             e.start_time, e.end_time, e.capacity
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      WHERE e.id = ${id}
      FOR UPDATE OF e
    `);

    return eventDtos[0] ?? null;
  }

  async selectAll(): Promise<EventDto[]> {
    return this.prisma.$queryRaw<EventDto[]>(Prisma.sql`
      SELECT e.id, e.title, e.venue_id, v.name AS venue_name,
             e.start_time, e.end_time, e.capacity
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      ORDER BY e.start_time, e.id
    `);
  }
}
