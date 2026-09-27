# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
COPY server ./server
COPY tests ./tests
RUN npm test && npm run build

FROM node:22-bookworm-slim AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ARG VERSION=1.0.0
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="Chengyan Chat" \
      org.opencontainers.image.description="An OpenAI-compatible AI chat workspace with local conversation history" \
      org.opencontainers.image.source="https://github.com/Ghost-soul/qwen" \
      org.opencontainers.image.url="https://github.com/Ghost-soul/qwen" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}"
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
WORKDIR /app
COPY --chown=node:node --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/server ./server
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then(r => { if (!r.ok) process.exit(1); return r.json(); }).then(d => { if (!d.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["node", "server/index.mjs", "--production"]
