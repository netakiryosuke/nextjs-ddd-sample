// interfaceは実行時に存在しないため、コンテナではSymbolで識別する。
export const TOKENS = {
  PrismaClient: Symbol("PrismaClient"),
  EventRepository: Symbol("EventRepository"),
  EventAvailabilityRepository: Symbol("EventAvailabilityRepository"),
  ReservationRepository: Symbol("ReservationRepository"),
  ReservationTransactionManager: Symbol("ReservationTransactionManager"),
  VenueRepository: Symbol("VenueRepository"),
};
