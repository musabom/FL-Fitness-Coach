# Production image for FL Fitness Coach (pnpm monorepo -> single Node service).
# Builds the React frontend and bundles the Express server; the server then
# serves both the API and the built frontend from one port.
FROM node:22-bookworm-slim
WORKDIR /app

# pnpm (lockfile is v9). NODE_ENV is intentionally NOT "production" during the
# build so pnpm keeps devDependencies (vite, tsx, esbuild) needed to build.
RUN npm install -g pnpm@9

COPY . .
RUN pnpm install --frozen-lockfile \
 && PORT=10000 BASE_PATH=/ pnpm --filter @workspace/web build \
 && pnpm --filter @workspace/api-server build

ENV NODE_ENV=production
ENV PUBLIC_DIR=/app/artifacts/web/dist/public
EXPOSE 8080
CMD ["node", "artifacts/api-server/dist/index.cjs"]
