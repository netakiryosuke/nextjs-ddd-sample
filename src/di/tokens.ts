// interfaceは実行時に存在しないため、コンテナではSymbolで識別する。
export const TOKENS = {
  PrismaClient: Symbol("PrismaClient"),
  EventRepository: Symbol("EventRepository"),
  EventAvailabilityRepository: Symbol("EventAvailabilityRepository"),
  ReservationRepository: Symbol("ReservationRepository"),
  VenueRepository: Symbol("VenueRepository"),
};
