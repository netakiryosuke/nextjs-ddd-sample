import { z } from "zod";

const venueSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export class Venue {
  public readonly id: string;
  public readonly name: string;

  constructor(id: string, name: string) {
    const parsed = venueSchema.parse({ id, name });
    this.id = parsed.id;
    this.name = parsed.name;
  }
}
