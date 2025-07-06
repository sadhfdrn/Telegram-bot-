FROM ghcr.io/puppeteer/puppeteer:latest

# Set working directory
WORKDIR /app

# Environment variables
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install additional system dependencies
USER root
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
  && apt-get autoremove -y \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Create non-root user (if not already exists)
RUN groupadd -g 1001 nodejs || true && \
    useradd -u 1001 -g nodejs nextjs || true

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production \
  && npm cache clean --force \
  && rm -rf /root/.npm /root/.cache /root/.config

# Install Puppeteer Chrome (if not already bundled)
RUN npx puppeteer browsers install chrome \
  && rm -rf /home/nextjs/.cache/puppeteer/chrome-* || true

# Copy app code
COPY . .

# Set ownership
RUN chown -R nextjs:nodejs /app
RUN chown -R nextjs:nodejs /home/nextjs/.cache/puppeteer || true

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start command
CMD ["npm", "start"]
