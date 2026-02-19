FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

# Remove any .env files from image
RUN rm -f .env .env.local

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["npx", "tsx", "server.ts"]
