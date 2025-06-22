# Use the official Node.js runtime as the base image
FROM node:22-bullseye

# Set the working directory inside the container
WORKDIR /app

# Update package lists and install FFmpeg and other dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Verify FFmpeg installation
RUN ffmpeg -version

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Set environment variables for FFmpeg (optional but recommended)
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

# Expose the port your app runs on (adjust as needed)
EXPOSE 3000

# Define the command to run your application
CMD ["npm", "start"]
