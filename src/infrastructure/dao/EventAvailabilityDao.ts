import type { EventAvailabilityDto } from "../dto/EventAvailabilityDto";
import { Prisma } from "../generated/prisma/client";

export class EventAvailabilityDao {
  constructor(private readonly prisma: Prisma.TransactionClient) {}

  async selectById(id: string): Promise<EventAvailabilityDto | null> {
    const eventAvailabilityDtos = await this.prisma.$queryRaw<
      EventAvailabilityDto[]
    >(Prisma.sql`
      SELECT e.id, e.title, e.venue_id, v.name AS venue_name,
             e.start_time, e.end_time, e.capacity,
             (
               SELECT COUNT(*)::integer
               FROM reservations r
               WHERE r.event_id = e.id
                 AND r.status = 'reserved'
             ) AS reservation_count
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      WHERE e.id = ${id}
    `);
    return eventAvailabilityDtos[0] ?? null;
  }

  async selectAll(): Promise<EventAvailabilityDto[]> {
    return this.prisma.$queryRaw<EventAvailabilityDto[]>(Prisma.sql`
      SELECT e.id, e.title, e.venue_id, v.name AS venue_name,
             e.start_time, e.end_time, e.capacity,
             (
               SELECT COUNT(*)::integer
               FROM reservations r
               WHERE r.event_id = e.id
                 AND r.status = 'reserved'
             ) AS reservation_count
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      ORDER BY e.start_time, e.id
    `);
  }
}
