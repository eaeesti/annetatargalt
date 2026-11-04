# syntax=docker/dockerfile:1.10
# The site's image. The build reads the backend's public content (the sitemap
# and the web app manifest are made then), so it needs the backend's address
# and an API token: the token comes in as a build secret, which is never
# written into the image, and the rest are public values. At runtime the
# server side reads the token, and the analytics settings, from the
# environment. Build from this folder:
#   docker build --secret id=strapi_api_token,env=STRAPI_API_TOKEN \
#     --build-arg NEXT_PUBLIC_SITE_URL=... --build-arg NEXT_PUBLIC_STRAPI_API_URL=... .

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
# NEXT_PUBLIC_ values are written into the browser's code at build time.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_STRAPI_API_URL
ARG PLAUSIBLE_DOMAIN
ARG UMAMI_WEBSITE_ID
# Next copies .env files into the standalone output. There are none here
# (.dockerignore), and none may reach the image if that ever changes.
RUN --mount=type=secret,id=strapi_api_token,env=STRAPI_API_TOKEN \
    pnpm build && rm -f .next/standalone/.env*

# ---

FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85

WORKDIR /app
# Next's standalone output: server.js and only the node_modules it uses.
# The static files and public/ aren't in it; Next serves them from these.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
# The node image's unprivileged user; the server gives it its own uid.
USER node
CMD ["node", "server.js"]
