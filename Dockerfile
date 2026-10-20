# ==========================================
# Empire Arena — Multi-Stage Production Dockerfile (Hardened)
# ==========================================

# Stage 1: Build the React + TypeScript frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit
COPY . .
RUN npm run build

# Stage 2: Production Python runtime for FastAPI backend & static assets
FROM python:3.11-slim AS production

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production \
    DATABASE_PATH=/app/data/empire_arena.db \
    BACKUP_DIR=/app/data/backups

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated unprivileged system group and user (Principle of Least Privilege)
RUN groupadd -r -g 10001 empire && \
    useradd -r -u 10001 -g empire -s /sbin/nologin -d /app empireuser

# Install Python backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy application code
COPY backend ./backend
COPY --from=frontend-builder /app/dist ./static

# Ensure persistent storage mount point exists with restricted permissions
RUN mkdir -p /app/data/backups && \
    chown -R empireuser:empire /app && \
    chmod -R 750 /app

EXPOSE 8000

# Health check probe against live FastAPI endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Drop root privileges and run as non-root user
USER empireuser

# Start Uvicorn production server
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips=127.0.0.1"]
