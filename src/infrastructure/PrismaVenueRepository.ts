import { Venue } from "../domain/venue/Venue";
import type { VenueRepository } from "../domain/venue/VenueRepository";
import type { Prisma } from "./generated/prisma/client";

export class PrismaVenueRepository implements VenueRepository {
  constructor(private readonly prisma: Prisma.TransactionClient) {}

  async findById(id: string): Promise<Venue | null> {
    const venueRecord = await this.prisma.venue.findUnique({ where: { id } });
    return venueRecord === null
      ? null
      : new Venue(venueRecord.id, venueRecord.name);
  }

  async findAll(): Promise<Venue[]> {
    const venueRecords = await this.prisma.venue.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return venueRecords.map(
      (venueRecord) => new Venue(venueRecord.id, venueRecord.name),
    );
  }

  async save(venue: Venue): Promise<Venue> {
    const venueRecord = await this.prisma.venue.upsert({
      where: { id: venue.id },
      create: { id: venue.id, name: venue.name },
      update: { name: venue.name },
    });
    return new Venue(venueRecord.id, venueRecord.name);
  }
}
