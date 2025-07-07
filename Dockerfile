FROM node:20-slim

# Set working directory
WORKDIR /app

# Puppeteer env (skip Chromium download; external Chrome used)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

# Install only essential tools
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for better security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs nextjs

# Ensure /tmp is writable (needed by Puppeteer)
RUN mkdir -p /tmp && chmod -R 777 /tmp && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Copy package files and install prod deps only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code
COPY . .

# Expose your app's port
EXPOSE 3000

# Optional: healthcheck for platforms like Koyeb
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start your app
CMD ["npm", "start"]
