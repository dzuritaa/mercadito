# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# --- Development: source is bind-mounted by docker-compose.dev.yml ---------
FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "npx prisma generate && npm run dev"]

# --- Build ---------------------------------------------------------------
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

# --- Production ----------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/next.config.mjs ./
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/src/lib/auth/password.ts ./src/lib/auth/password.ts
# The generated Prisma client is not part of the pruned dependency tree.
RUN npx prisma generate && chown -R node:node node_modules/.prisma
USER node
EXPOSE 3000
CMD ["sh", "scripts/docker-entrypoint.sh"]
