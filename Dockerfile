# Builds the whole app (website + API server) into one container for Cloud Run.

FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @workspace/nanp-app run build \
 && pnpm --filter @workspace/api-server run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    STATIC_DIR=/app/public
# The server is bundled into dist/ by esbuild, so no node_modules are needed.
COPY --from=build /app/artifacts/api-server/dist ./dist
COPY --from=build /app/artifacts/nanp-app/dist/public ./public
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
