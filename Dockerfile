FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

# mssql/tedious/@azure/identity are marked ssr.external in vite.config.ts, so
# the built server still requires them from node_modules instead of bundling
# them; a production-only install keeps those resolvable at runtime.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 8080

# server.js's default export is a web-standard fetch handler, not a listening
# server; srvx (already pulled in by @tanstack/react-start-server) adapts it
# to Node's http module and binds PORT/HOST.
CMD ["node_modules/.bin/srvx", "dist/server/server.js", "--static", "../client"]
