FROM mcr.microsoft.com/devcontainers/javascript-node:0-18

# Install system dependencies and pip as root
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3-pip tesseract-ocr libtesseract-dev \
 && rm -rf /var/lib/apt/lists/*

# Switch to the 'node' user before installing Python packages
USER node
RUN pip3 install --user --no-cache-dir \
      pytesseract pillow opencv-python

WORKDIR /workspace