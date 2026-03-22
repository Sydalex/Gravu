FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN bunx prisma generate

EXPOSE 3000

# Run database migrations then start the server
# DATABASE_URL must point to a persistent volume path (e.g. file:/app/data/gravu.db)
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run src/index.ts"]
