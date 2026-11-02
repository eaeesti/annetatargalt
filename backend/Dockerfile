# The backend's image. It holds no secrets and no settings: everything comes
# from the environment it runs in, and nothing in config/ is read at build
# time, so one image runs anywhere. Build from this folder: docker build .

# By digest, so a build never takes a changed base image unseen
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS builder

WORKDIR /app
# pnpm at the version package.json's packageManager pins
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack install
# The supply-chain settings in pnpm-workspace.yaml apply here too
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
# strapi build, not pnpm build: its prebuild writes the site's generated
# types, from outside this folder. The admin panel's build needs the heap.
RUN NODE_OPTIONS=--max-old-space-size=2048 pnpm exec strapi build && \
    pnpm prune --prod

# ---

FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85

WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/favicon.png ./
# For dist/src/scripts/migrate.js
COPY --from=builder /app/src/db/migrations ./src/db/migrations

ENV NODE_ENV=production HOST=0.0.0.0 PORT=1337
EXPOSE 1337
# The node image's unprivileged user; the server gives it its own uid, with
# a read-only root filesystem and /tmp in memory.
USER node
# Node itself, not pnpm or the strapi script: they'd fetch pnpm into $HOME
# on every start, and node passes the stop signal straight to Strapi.
CMD ["node", "node_modules/@strapi/strapi/bin/strapi.js", "start"]
