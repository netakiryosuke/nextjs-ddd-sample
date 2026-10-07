FROM node:24-bookworm-slim AS base

WORKDIR /app
ENV TZ=Asia/Tokyo
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends openssl

FROM base AS dependencies

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS migration

COPY prisma ./prisma
COPY prisma.config.ts ./
CMD ["npm", "run", "db:migrate"]

FROM dependencies AS builder

COPY . .
RUN npm run db:generate && npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3100

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3100
CMD ["node", "server.js"]
