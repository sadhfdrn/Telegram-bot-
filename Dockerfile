FROM ghcr.io/puppeteer/puppeteer:latest

# Set working directory
WORKDIR /app

# Environment variables
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

# Install additional system dependencies
USER root
RUN apt-get update && apt-get install -y \
      ffmpeg \
      curl \
      && rm -rf /var/lib/apt/lists/*

# Create non-root user (if not already exists)
RUN groupadd -g 1001 nodejs || true && \
    useradd -u 1001 -g nodejs nextjs || true

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy app code
COPY . .

# Set ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start command
CMD ["npm", "start"]
