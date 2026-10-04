import { defineConfig } from "prisma/config";

const LOCAL_DATABASE_URL =
  "postgresql://ddd:ddd@localhost:55433/event_reservation?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
  },
});
