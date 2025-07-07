FROM node:20-slim

# Set working directory
WORKDIR /app

# Environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe
ENV HOME=/tmp
ENV TMPDIR=/tmp

# Install only essential packages
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nextjs

# Set permissions
RUN mkdir -p /tmp && chmod -R 777 /tmp && chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Copy and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code
COPY . .

# Expose app port
EXPOSE 3000

# Optional healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start app
CMD ["npm", "start"]
