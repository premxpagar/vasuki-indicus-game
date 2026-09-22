# Lightweight Node.js container for AWS App Runner or ECS Fargate
FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy server code
COPY server.js ./

# App Runner listens on the configured PORT (default 3000)
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
