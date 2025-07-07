FROM node:20-slim

WORKDIR /app

# Puppeteer & system env
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe
ENV HOME=/home/nextjs
ENV TMPDIR=/tmp

# Install essential tools only
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user with writable home
RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -g nodejs nextjs && \
    mkdir -p /home/nextjs && \
    chown -R nextjs:nodejs /home/nextjs

# Prepare writable tmp
RUN mkdir -p /tmp && chmod -R 777 /tmp

# Set permissions on app directory
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Copy and install production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
