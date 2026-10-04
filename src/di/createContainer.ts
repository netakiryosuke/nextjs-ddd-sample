import { Container } from "inversify";
import { EventApplicationService } from "../application/event/EventApplicationService";
import type { EventAvailabilityRepository } from "../domain/event/EventAvailabilityRepository";
import type { EventRepository } from "../domain/event/EventRepository";
import type { ReservationRepository } from "../domain/reservation/ReservationRepository";
import type { VenueRepository } from "../domain/venue/VenueRepository";
import { EventAvailabilityDao } from "../infrastructure/dao/EventAvailabilityDao";
import { EventDao } from "../infrastructure/dao/EventDao";
import type { Prisma } from "../infrastructure/generated/prisma/client";
import { PrismaEventAvailabilityRepository } from "../infrastructure/PrismaEventAvailabilityRepository";
import { PrismaEventRepository } from "../infrastructure/PrismaEventRepository";
import { PrismaReservationRepository } from "../infrastructure/PrismaReservationRepository";
import { PrismaVenueRepository } from "../infrastructure/PrismaVenueRepository";
import { TOKENS } from "./tokens";

export function createContainer(prismaClient: Prisma.TransactionClient): Container {
  const container = new Container({ defaultScope: "Singleton" });

  container
    .bind<Prisma.TransactionClient>(TOKENS.PrismaClient)
    .toConstantValue(prismaClient);

  container.bind(EventDao).toResolvedValue(
    (prismaClient: Prisma.TransactionClient) => new EventDao(prismaClient),
    [TOKENS.PrismaClient],
  );

  container.bind(EventAvailabilityDao).toResolvedValue(
    (prismaClient: Prisma.TransactionClient) =>
      new EventAvailabilityDao(prismaClient),
    [TOKENS.PrismaClient],
  );

  container.bind<EventRepository>(TOKENS.EventRepository).toResolvedValue(
    (prismaClient: Prisma.TransactionClient, eventDao: EventDao) =>
      new PrismaEventRepository(prismaClient, eventDao),
    [TOKENS.PrismaClient, EventDao],
  );

  container
    .bind<EventAvailabilityRepository>(TOKENS.EventAvailabilityRepository)
    .toResolvedValue(
      (eventAvailabilityDao: EventAvailabilityDao) =>
        new PrismaEventAvailabilityRepository(eventAvailabilityDao),
      [EventAvailabilityDao],
    );

  container
    .bind<ReservationRepository>(TOKENS.ReservationRepository)
    .toResolvedValue(
      (prismaClient: Prisma.TransactionClient) =>
        new PrismaReservationRepository(prismaClient),
      [TOKENS.PrismaClient],
    );

  container.bind<VenueRepository>(TOKENS.VenueRepository).toResolvedValue(
    (prismaClient: Prisma.TransactionClient) =>
      new PrismaVenueRepository(prismaClient),
    [TOKENS.PrismaClient],
  );

  container.bind(EventApplicationService).toResolvedValue(
    (
      eventRepository: EventRepository,
      eventAvailabilityRepository: EventAvailabilityRepository,
    ) => new EventApplicationService(eventRepository, eventAvailabilityRepository),
    [TOKENS.EventRepository, TOKENS.EventAvailabilityRepository],
  );

  return container;
}
