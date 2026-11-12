FROM node:20-alpine

RUN apk add --no-cache openssl curl python3 make g++

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
COPY server/prisma ./prisma
RUN npm ci

COPY server/src ./src
COPY shared /app/shared
# Complete-validation reuses the taker visibility/condition engines (no lucide in that tree).
COPY src/utils/survey /app/src/utils/survey
COPY docker/api-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3003

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
  CMD curl -fsS http://127.0.0.1:3003/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
