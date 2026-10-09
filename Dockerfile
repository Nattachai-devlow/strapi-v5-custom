# syntax=docker/dockerfile:1.7

# IAAA / Authentication: pin the base image by tag AND digest so the build is
# reproducible and cannot silently pick up a tampered/updated base layer.
ARG NODE_IMAGE=node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

FROM ${NODE_IMAGE} AS base

# IAAA / Accountability: provenance metadata baked into the image.
LABEL org.opencontainers.image.title="strapi-v5-custom" \
      org.opencontainers.image.description="Hardened Strapi v5 production image" \
      org.opencontainers.image.vendor="nattachaiwsm" \
      org.opencontainers.image.base.name="docker.io/library/node:22-alpine"

# IAAA / Identification: never run as root. The image ships the non-root
# `node` service account (fixed UID/GID 1000) which keeps existing volumes and
# downstream builds that use `--chown=node:node` working. tini gives us a real
# init (PID 1) that reaps zombies and forwards signals.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_CACHE=/tmp/.npm
WORKDIR /opt/app

# ---- dependencies (build) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- production dependencies only (no dev tooling in the runtime layer) ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime ----
FROM base AS production

ARG VERSION=0.1.0
ARG VCS_REF=unknown
LABEL org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}"

ENV HOST=0.0.0.0 \
    PORT=1337 \
    HOME=/tmp \
    XDG_CONFIG_HOME=/tmp/.config \
    XDG_CACHE_HOME=/tmp/.cache

COPY package.json package-lock.json ./
COPY --from=prod-deps --chown=node:node /opt/app/node_modules ./node_modules
COPY --from=build --chown=node:node /opt/app/dist ./dist
COPY --from=build --chown=node:node /opt/app/config ./config
COPY --from=build --chown=node:node /opt/app/src ./src
COPY --from=build --chown=node:node /opt/app/public ./public
COPY --from=build --chown=node:node /opt/app/scripts ./scripts
COPY --from=build --chown=node:node /opt/app/data ./data
COPY --from=build --chown=node:node /opt/app/tsconfig.json ./tsconfig.json

# IAAA / Authorization: least privilege. Writable paths are created and owned by
# the service account; everything else stays read-only.
RUN mkdir -p .tmp database/migrations public/uploads \
    && chown node:node /opt/app package.json package-lock.json .tmp database database/migrations public public/uploads \
    && chmod 750 /opt/app

USER node
EXPOSE 1337

# IAAA / Accountability: liveness signal used by orchestrators and compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/admin/init" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "node_modules/.bin/strapi", "start"]
