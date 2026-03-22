# Stage 1: Build the React app
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the production bundle
# VITE_BACKEND_URL is intentionally left empty so the app uses relative /api/
# paths, which nginx proxies to the backend container at runtime.
RUN bun run build

# Stage 2: Serve with nginx
FROM nginx:stable-alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config (SPA routing + /api/ proxy to backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
