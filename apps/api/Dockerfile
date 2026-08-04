FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG DATABASE_URL=postgresql://x:x@localhost:5432/x
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate
RUN NODE_OPTIONS=--max-old-space-size=768 npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
EXPOSE 3001
CMD ["sh", "-c", "output=$(npx prisma migrate deploy 2>&1); echo \"$output\"; if echo \"$output\" | grep -q 'P3008'; then FAILED=$(echo \"$output\" | grep 'The migration' | sed 's/.*`\\([^`]*\\)`.*/\\1/' | head -1); [ -n \"$FAILED\" ] && npx prisma migrate resolve --applied \"$FAILED\" > /dev/null 2>&1 && npx prisma migrate deploy 2>&1; elif echo \"$output\" | grep -q 'P3005'; then FIRST=$(ls prisma/migrations | sort | grep -v migration_lock | head -1); [ -n \"$FIRST\" ] && npx prisma migrate resolve --applied \"$FIRST\" > /dev/null 2>&1 && npx prisma migrate deploy 2>&1; fi && node dist/server.js"]
