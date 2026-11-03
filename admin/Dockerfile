# The admin panel's image. It holds no secrets and no settings: the server
# side reads STRAPI_URL and the Google sign-in settings from the environment
# at runtime, and nothing is prerendered with data, so one image runs
# anywhere. Build from this folder: docker build .

# By digest, so a build never takes a changed base image unseen
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS builder

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# pnpm at the version package.json's packageManager pins
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack install
# The supply-chain settings in pnpm-workspace.yaml apply here too
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---

FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85

WORKDIR /app
# Next's standalone output: server.js and only the node_modules it uses.
# The static files aren't in it; Next serves them from .next/static.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3001 NEXT_TELEMETRY_DISABLED=1
EXPOSE 3001
# The node image's unprivileged user; the server gives it its own uid, with
# a read-only root filesystem and /tmp in memory.
USER node
CMD ["node", "server.js"]
