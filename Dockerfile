FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
RUN corepack enable pnpm
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY src/frontend/package.json ./src/frontend/package.json
COPY src/backend/package.json ./src/backend/package.json
COPY src/shared/package.json ./src/shared/package.json
COPY src/agent/package.json ./src/agent/package.json
COPY src/agent/contracts/package.json ./src/agent/contracts/package.json
COPY src/agent/browser/package.json ./src/agent/browser/package.json
COPY src/backend/prisma ./src/backend/prisma
COPY prisma.config.ts ./prisma.config.ts
COPY src/scripts/prisma-postinstall.cjs ./src/scripts/prisma-postinstall.cjs
COPY src/scripts/require-pnpm.cjs ./src/scripts/require-pnpm.cjs
RUN pnpm install --frozen-lockfile

FROM dependencies AS frontend-build
ARG REACT_APP_API_URL=/api
ARG REACT_APP_GOOGLE_CLIENT_ID=
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID
ENV DISABLE_ESLINT_PLUGIN=true
ENV CI=false
ENV GENERATE_SOURCEMAP=false
COPY src/frontend ./src/frontend
COPY src/shared ./src/shared
COPY src/agent/contracts ./src/agent/contracts
COPY src/agent/browser ./src/agent/browser
COPY src/agent/scripts/frontend-browser.cjs ./src/agent/scripts/frontend-browser.cjs
RUN pnpm run build

FROM nginx:1.27-alpine AS frontend
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/src/frontend/build /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

FROM dependencies AS backend
ENV NODE_ENV=production
ENV PORT=5000
COPY src/backend/src ./src/backend/src
COPY src/agent ./src/agent
COPY docs/ai-lab-assistant/ops/OPS-00-live.json ./docs/ai-lab-assistant/ops/OPS-00-live.json
COPY src/shared ./src/shared
COPY src/storage/uploads ./src/storage/uploads
EXPOSE 5000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "src/backend/src/Server.js"]

# API + internal Python + worker share one host, retaining loopback-only transport.
# API-only remains the default until AI_PRODUCTION_ENABLED is explicitly true.
FROM backend AS backend-ai
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.11.22 /uv /usr/local/bin/uv
ENV UV_PYTHON_DOWNLOADS=never \
    UV_PYTHON=/usr/bin/python3 \
    UV_LINK_MODE=copy \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
RUN uv sync --project src/agent/python --frozen --no-dev --no-install-project
ENTRYPOINT ["tini", "--"]
CMD ["node", "src/agent/scripts/production-entry.cjs"]
