# Multi-stage image for the standalone mock HCM server.
FROM node:18-alpine AS builder

WORKDIR /app

COPY mock-hcm/package*.json ./
RUN npm ci

COPY mock-hcm/tsconfig.json ./
COPY mock-hcm/src ./src

RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY mock-hcm/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main.js"]
