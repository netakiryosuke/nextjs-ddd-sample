FROM node:24-bookworm-slim AS base

WORKDIR /app
ENV TZ=Asia/Tokyo
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends openssl

FROM base AS dependencies

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS runtime-dependencies

RUN npm prune --omit=dev

FROM dependencies AS builder

COPY . .
RUN npm run db:generate && npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=runtime-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chmod=755 docker-entrypoint.sh ./

USER node
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
