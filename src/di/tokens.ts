// interfaceは実行時に存在しないため、コンテナではSymbolで識別する。
export const TOKENS = {
  PrismaClient: Symbol("PrismaClient"),
  TransactionalPrismaClient: Symbol("TransactionalPrismaClient"),
  EventRepository: Symbol("EventRepository"),
  EventAvailabilityRepository: Symbol("EventAvailabilityRepository"),
  ReservationRepository: Symbol("ReservationRepository"),
  TransactionManager: Symbol("TransactionManager"),
  VenueRepository: Symbol("VenueRepository"),
};
