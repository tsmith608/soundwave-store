# One image, two processes:
#   web:    npm start            (Next.js server)
#   worker: npm run worker       (print rendering, fulfillment, email, maintenance)
# Release step (run once per deploy, before new web/worker start): npm run release
#
# The Playwright base image ships Chromium + fonts needed to render print files.
FROM mcr.microsoft.com/playwright:v1.56.0-noble AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
# NEXT_PUBLIC_* values are inlined at build time: pass them as build args.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BRAND_NAME
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ARG NEXT_PUBLIC_LEGAL_NAME
ARG NEXT_PUBLIC_LEGAL_STATE
ARG NEXT_PUBLIC_GA4_ID
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_TIKTOK_PIXEL_ID
ARG NEXT_PUBLIC_SENTRY_DSN
ENV SKIP_ENV_VALIDATION=true
RUN npm run build && npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=pwuser:pwuser /app /app
USER pwuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
