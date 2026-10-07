import { Container } from "inversify";
import { EventApplicationService } from "../application/event/EventApplicationService";
import { ReservationApplicationService } from "../application/reservation/ReservationApplicationService";
import type { TransactionManager } from "../application/TransactionManager";
import { PrismaClientProvider } from "../infrastructure/db/PrismaClientProvider";
import { createTransactionalPrismaClient } from "../infrastructure/db/createTransactionalPrismaClient";
import type { EventAvailabilityRepository } from "../domain/event/EventAvailabilityRepository";
import type { EventRepository } from "../domain/event/EventRepository";
import type { ReservationRepository } from "../domain/reservation/ReservationRepository";
import type { VenueRepository } from "../domain/venue/VenueRepository";
import { EventAvailabilityDao } from "../infrastructure/dao/EventAvailabilityDao";
import { EventDao } from "../infrastructure/dao/EventDao";
import type {
  Prisma,
  PrismaClient,
} from "../infrastructure/generated/prisma/client";
import { PrismaEventAvailabilityRepository } from "../infrastructure/PrismaEventAvailabilityRepository";
import { PrismaEventRepository } from "../infrastructure/PrismaEventRepository";
import { PrismaReservationRepository } from "../infrastructure/PrismaReservationRepository";
import { PrismaTransactionManager } from "../infrastructure/PrismaTransactionManager";
import { PrismaVenueRepository } from "../infrastructure/PrismaVenueRepository";
import { TOKENS } from "./tokens";

export function createContainer(prismaClient: PrismaClient): Container {
  const container = new Container({ defaultScope: "Singleton" });

  container
    .bind<PrismaClient>(TOKENS.PrismaClient)
    .toConstantValue(prismaClient);

  container
    .bind(PrismaClientProvider)
    .toResolvedValue(
      (prismaClient: PrismaClient) => new PrismaClientProvider(prismaClient),
      [TOKENS.PrismaClient],
    );

  container
    .bind<Prisma.TransactionClient>(TOKENS.TransactionalPrismaClient)
    .toResolvedValue(
      (
        prismaClient: PrismaClient,
        prismaClientProvider: PrismaClientProvider,
      ) => createTransactionalPrismaClient(prismaClient, prismaClientProvider),
      [TOKENS.PrismaClient, PrismaClientProvider],
    );

  container
    .bind(EventDao)
    .toResolvedValue(
      (prismaClient: Prisma.TransactionClient) => new EventDao(prismaClient),
      [TOKENS.TransactionalPrismaClient],
    );

  container
    .bind(EventAvailabilityDao)
    .toResolvedValue(
      (prismaClient: Prisma.TransactionClient) =>
        new EventAvailabilityDao(prismaClient),
      [TOKENS.TransactionalPrismaClient],
    );

  container
    .bind<EventRepository>(TOKENS.EventRepository)
    .toResolvedValue(
      (prismaClient: Prisma.TransactionClient, eventDao: EventDao) =>
        new PrismaEventRepository(prismaClient, eventDao),
      [TOKENS.TransactionalPrismaClient, EventDao],
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
      [TOKENS.TransactionalPrismaClient],
    );

  container
    .bind<VenueRepository>(TOKENS.VenueRepository)
    .toResolvedValue(
      (prismaClient: Prisma.TransactionClient) =>
        new PrismaVenueRepository(prismaClient),
      [TOKENS.TransactionalPrismaClient],
    );

  container
    .bind(EventApplicationService)
    .toResolvedValue(
      (
        eventRepository: EventRepository,
        eventAvailabilityRepository: EventAvailabilityRepository,
      ) =>
        new EventApplicationService(
          eventRepository,
          eventAvailabilityRepository,
        ),
      [TOKENS.EventRepository, TOKENS.EventAvailabilityRepository],
    );

  container
    .bind<TransactionManager>(TOKENS.TransactionManager)
    .toResolvedValue(
      (
        prismaClient: PrismaClient,
        prismaClientProvider: PrismaClientProvider,
      ) => new PrismaTransactionManager(prismaClient, prismaClientProvider),
      [TOKENS.PrismaClient, PrismaClientProvider],
    );

  container
    .bind(ReservationApplicationService)
    .toResolvedValue(
      (
        eventRepository: EventRepository,
        eventAvailabilityRepository: EventAvailabilityRepository,
        reservationRepository: ReservationRepository,
        transactionManager: TransactionManager,
      ) =>
        new ReservationApplicationService(
          eventRepository,
          eventAvailabilityRepository,
          reservationRepository,
          transactionManager,
        ),
      [
        TOKENS.EventRepository,
        TOKENS.EventAvailabilityRepository,
        TOKENS.ReservationRepository,
        TOKENS.TransactionManager,
      ],
    );

  return container;
}
