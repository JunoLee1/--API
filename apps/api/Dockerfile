FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG DATABASE_URL=postgresql://x:x@localhost:5432/x
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
