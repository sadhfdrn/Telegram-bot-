# Use Node.js official image as base
FROM node:alpine

# Install FFmpeg and other dependencies needed for Sharp
RUN apk add --no-cache \
    ffmpeg \
    vips-dev \
    build-base \
    python3 \
    make \
    g++

# Set FFmpeg environment variables
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port (adjust as needed)
EXPOSE 3000

# Run the application
CMD ["npm", "start"]
