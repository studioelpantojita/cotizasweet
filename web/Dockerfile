FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
COPY contracts/ /contracts/
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/cotiza.sqlite COTIZA_RUNTIME_USER=node
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /contracts /contracts
RUN mkdir -p /app/data && chown node:node /app/data && chmod 700 /app/data
COPY --chmod=755 deploy/container-entrypoint.sh /usr/local/bin/cotiza-entrypoint
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/cotiza-entrypoint"]
CMD ["node","server.js"]
