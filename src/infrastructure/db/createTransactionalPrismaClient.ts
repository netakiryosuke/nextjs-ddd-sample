import { Prisma, PrismaClient } from "../generated/prisma/client";
import { PrismaClientProvider } from "./PrismaClientProvider";

export function createTransactionalPrismaClient(
  prisma: PrismaClient,
  prismaClientProvider: PrismaClientProvider,
): Prisma.TransactionClient {
  const modelProperties = new Set(
    Object.values(Prisma.ModelName).map(
      (name) => name.charAt(0).toLowerCase() + name.slice(1),
    ),
  );
  const delegates = new Map<PropertyKey, object>();

  return new Proxy(prisma, {
    get(target, property) {
      const value = Reflect.get(target, property, target);

      if (typeof property === "string" && modelProperties.has(property)) {
        if (!delegates.has(property)) {
          delegates.set(
            property,
            new Proxy(value, {
              get(delegate, operation) {
                const method = Reflect.get(delegate, operation, delegate);

                if (typeof method !== "function") {
                  return method;
                }

                return (...args: unknown[]) => {
                  const client = prismaClientProvider.client;
                  const currentDelegate = Reflect.get(client, property, client);
                  return Reflect.apply(
                    Reflect.get(currentDelegate, operation, currentDelegate),
                    currentDelegate,
                    args,
                  );
                };
              },
            }),
          );
        }

        return delegates.get(property);
      }

      if (typeof value !== "function") {
        return value;
      }

      return (...args: unknown[]) => {
        const client = prismaClientProvider.client;
        return Reflect.apply(
          Reflect.get(client, property, client),
          client,
          args,
        );
      };
    },
  });
}
