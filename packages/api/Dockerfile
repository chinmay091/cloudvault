# CloudVault API - Multi-stage Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
RUN npm ci --ignore-scripts
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
RUN npm run build --workspace=@cloudvault/shared
RUN cd packages/api && npx prisma generate
RUN npm run build --workspace=@cloudvault/api

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S cloudvault -u 1001
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/generated ./generated
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
USER cloudvault
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
