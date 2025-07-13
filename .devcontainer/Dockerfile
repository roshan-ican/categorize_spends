FROM mcr.microsoft.com/devcontainers/javascript-node:0-18

# Install system dependencies and pip as root
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    tesseract-ocr \
    libtesseract-dev \
    libgl1 \
 && rm -rf /var/lib/apt/lists/*

# Switch to node user for devcontainer consistency
USER node

WORKDIR /workspace