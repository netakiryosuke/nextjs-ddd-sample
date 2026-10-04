import "server-only";
import { prisma } from "../infrastructure/db/prismaClient";
import { createContainer } from "./createContainer";

export const container = createContainer(prisma);
