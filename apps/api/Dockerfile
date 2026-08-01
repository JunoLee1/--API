FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
EXPOSE 3001
CMD ["sh", "-c", "node -e \"const {execSync}=require('child_process');execSync('npx prisma migrate deploy',{stdio:'inherit'})\" && node dist/server.js"]
