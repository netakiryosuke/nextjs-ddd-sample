import { defineConfig } from "prisma/config";

const LOCAL_DATABASE_URL =
  "postgresql://ddd:ddd@localhost:5432/event_reservation?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "prisma db execute --file prisma/seed.sql",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
  },
});
