FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy application source
COPY src ./src
COPY tsconfig.json ./

# Environment defaults
ENV HOST=0.0.0.0
ENV PORT=7000
ENV NODE_ENV=production

EXPOSE 7000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:7000/health || exit 1

CMD ["bun", "run", "src/index.ts"]
