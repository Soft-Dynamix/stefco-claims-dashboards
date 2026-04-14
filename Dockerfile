# ─────────────────────────────────────────────────────────────────────────────
# Stefco Claims Dashboard — Docker Production Image
#
# Builder:  Node.js 20 Alpine + bun (fast installs)
# Runtime:  Node.js 20 Alpine (minimal, no extras)
# Database: SQLite (file-based, persisted via volume)
#
# KEY DESIGN: Database schema is created in the BUILDER stage (where all
# tools work correctly) and shipped as a template. The entrypoint simply
# copies the template if no database exists. No prisma CLI at runtime.
#
# PRISMA IN STANDALONE: Prisma needs its generated client + query engine
# at runtime. We copy them into the standalone output's node_modules
# so the import path '@prisma/client' resolves correctly.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install bun for FAST package installation (10-20x faster than npm)
RUN npm install -g bun

# Install dependencies using bun (reads bun.lock, parallel downloads)
COPY package.json bun.lock ./
RUN bun install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# ── Create database with schema in builder (prisma CLI works perfectly here) ──
RUN mkdir -p /app/db && \
    DATABASE_URL="file:/app/db/template.db" npx prisma db push --skip-generate && \
    echo "[builder] Database template created successfully"

# Build Next.js standalone output
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

# ── Stage 2: Production Runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy built Next.js standalone output (includes traced JS dependencies)
COPY --from=builder /app/.next/standalone ./next-service-dist/

# Copy static assets and public files into the standalone directory
COPY --from=builder /app/.next/static ./next-service-dist/.next/static/
COPY --from=builder /app/public ./next-service-dist/public/

# ── Prisma: Copy generated client + query engine into standalone node_modules ──
# The standalone build traces JS files but NOT native binaries (.node, .so).
# We must manually copy the full Prisma packages so the query engine resolves.
RUN mkdir -p ./next-service-dist/node_modules/.prisma && \
    mkdir -p ./next-service-dist/node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma/client ./next-service-dist/node_modules/.prisma/client
COPY --from=builder /app/node_modules/@prisma/client ./next-service-dist/node_modules/@prisma/client
COPY --from=builder /app/node_modules/@prisma/engines ./next-service-dist/node_modules/@prisma/engines

# ── Database template (schema-only, created in builder) ──
COPY --from=builder /app/db/template.db /app/db-template/template.db

# Create directories for data persistence
RUN mkdir -p /app/data /app/db /app/logs

# Create health check script (inline to avoid Windows \r\n issues)
# Used by docker-compose healthcheck — avoids YAML escaping problems
RUN cat > /app/healthcheck.js << 'HCSCRIPT'
const http = require('http');
const req = http.get('http://localhost:3000/api/health', (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => process.exit(1));
req.setTimeout(3000, () => { req.destroy(); process.exit(1); });
HCSCRIPT

# Create startup script (inline to avoid Windows \r\n line ending issues)
RUN cat > /app/entrypoint.sh << 'ENTRYPOINT'
#!/bin/sh
set -e

echo "========================================="
echo "  Stefco Claims Dashboard"
echo "  Starting Docker Container..."
echo "========================================="

# ── Database Setup (simple file copy — no prisma CLI needed) ──
DATABASE_URL="${DATABASE_URL:-file:/app/db/custom.db}"
DB_PATH="${DATABASE_URL#file:}"
DB_DIR=$(dirname "$DB_PATH")
mkdir -p "${DB_DIR}"

if [ ! -f "$DB_PATH" ]; then
    echo "[init] No database found. Copying template..."
    cp /app/db-template/template.db "$DB_PATH"
    echo "[init] Database ready: $DB_PATH"
else
    echo "[init] Existing database found: $DB_PATH"
fi

# ── Environment ──
export NODE_ENV=production
export PORT=3000
export HOSTNAME=0.0.0.0

echo ""
echo "[env] NODE_ENV       = $NODE_ENV"
echo "[env] PORT           = $PORT"
echo "[env] DATABASE_URL   = ${DATABASE_URL}"
echo "[env] IMAP_HOST      = ${IMAP_HOST:-not set}"
echo "[env] SMTP_HOST      = ${SMTP_HOST:-not set}"
echo "[env] AI Provider    = ${AI_PROVIDER:-gemini}"
echo ""

# ── Verify Prisma engine is accessible ──
if [ -d "/app/next-service-dist/node_modules/@prisma/engines" ]; then
    echo "[init] Prisma engines: OK"
else
    echo "[warn] Prisma engines directory NOT found — database queries may fail"
fi

# ── Start Next.js (foreground — this IS the main process) ──
echo "[start] Launching Next.js server on port 3000..."
echo ""
echo "========================================="
echo "  Stefco Claims Dashboard is READY"
echo "  Dashboard: http://localhost:${PORT:-3000}"
echo "========================================="
echo ""

cd /app/next-service-dist
exec node server.js
ENTRYPOINT

RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/db/custom.db
ENV AI_PROVIDER=gemini

# Expose Next.js port directly (no Caddy proxy needed)
EXPOSE 3000

# Volumes for persistent data
VOLUME ["/app/db", "/app/data", "/app/logs"]

# Healthcheck is defined in docker-compose.yml for better control

ENTRYPOINT ["/app/entrypoint.sh"]
