FROM oven/bun:1

WORKDIR /app

# Copy workspace manifests for layer caching
COPY package.json bun.lock ./
COPY core/package.json ./core/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN bun install --frozen-lockfile

COPY core ./core
COPY client ./client
COPY server ./server

# Build client (vite) + generate Prisma client
RUN bun run build

EXPOSE 3000

# Runs: cd server && bunx prisma migrate deploy && bun run start
CMD ["bun", "run", "start"]
