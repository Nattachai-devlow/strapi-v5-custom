FROM node:22-alpine AS deps
WORKDIR /opt/app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-alpine AS production
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337
WORKDIR /opt/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /opt/app/dist ./dist
COPY --from=build --chown=node:node /opt/app/config ./config
COPY --from=build --chown=node:node /opt/app/src ./src
COPY --from=build --chown=node:node /opt/app/public ./public
COPY --from=build --chown=node:node /opt/app/scripts ./scripts
COPY --from=build --chown=node:node /opt/app/data ./data
COPY --from=build --chown=node:node /opt/app/tsconfig.json ./tsconfig.json

RUN mkdir -p .tmp database/migrations public/uploads \
    && chown node:node /opt/app .tmp database database/migrations public/uploads public

USER node
EXPOSE 1337

CMD ["npm", "start"]
