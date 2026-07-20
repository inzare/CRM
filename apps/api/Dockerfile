FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

FROM dependencies AS build
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY tsconfig.base.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN npm run db:generate && npm run build -w @consultflow/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S nodejs && adduser -S consultflow -G nodejs
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY package.json ./
USER consultflow
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
