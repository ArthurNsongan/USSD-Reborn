# GhostSignal / USSD-Reborn: one container serving the USSD webhook, the API and the simulator.

# --- Stage 1: build the React simulator --------------------------------------------------------
FROM node:22-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python runtime ---------------------------------------------------------------------
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    USSD_DB_PATH=/tmp/ussd_sessions.db \
    PORT=8000

WORKDIR /app
COPY pyproject.toml README.md LICENSE ./
COPY core/ core/
COPY scripts/ scripts/
COPY mcp_server/ mcp_server/
RUN pip install .

COPY main.py ./
COPY schemas/ schemas/
COPY apps/ apps/
COPY --from=frontend /build/dist/ frontend/dist/

# Run as an unprivileged user; sessions live in /tmp (demo data, recreated on restart).
RUN useradd --create-home --uid 10001 ghost
USER ghost

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health', timeout=4)"

# PORT is injected by Render, Railway and Fly.io; 8000 locally.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
