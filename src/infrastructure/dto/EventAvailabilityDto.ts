import type { EventDto } from "./EventDto";

export type EventAvailabilityDto = EventDto & {
  reservation_count: number;
};
