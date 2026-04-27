FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install deps
RUN npm install --only=production && npm cache clean --force

# Copy source
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["npm", "start"]
