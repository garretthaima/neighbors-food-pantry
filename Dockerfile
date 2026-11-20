# syntax=docker/dockerfile:1
# One image: the Express server, which also serves the built React app.

# Stage 1: build the web app.
FROM node:26 AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace web
COPY web web
RUN npm run build --workspace web

# Stage 2: production dependencies for the server only (no test tooling).
FROM node:26 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace server

# Stage 3: runtime.
FROM node:26-slim
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx && \
    groupadd -r nodeapp -g 1001 && \
    useradd -r -g nodeapp -u 1001 -m nodeapp
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server/package.json server/
COPY server/src server/src
COPY server/migrations server/migrations
COPY --from=web /app/web/dist web/dist

ENV NODE_ENV=production \
    PORT=4000 \
    WEB_DIST=/app/web/dist
USER nodeapp
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||4000)+'/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Node runs the TypeScript sources directly; there is no server build step.
CMD ["node", "server/src/index.ts"]
