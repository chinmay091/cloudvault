# CloudVault Worker - Multi-stage Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/worker/package.json ./packages/worker/
RUN npm ci --ignore-scripts
COPY packages/shared ./packages/shared
COPY packages/worker ./packages/worker
RUN npm run build --workspace=@cloudvault/shared
RUN npm run build --workspace=@cloudvault/worker

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S cloudvault -u 1001
COPY --from=builder /app/packages/worker/dist ./dist
COPY --from=builder /app/packages/worker/package.json ./
COPY --from=builder /app/node_modules ./node_modules
USER cloudvault
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
