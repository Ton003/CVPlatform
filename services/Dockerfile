# Use slim Python base — much smaller and simpler than pytorch/pytorch CUDA images
# The official pytorch/pytorch image has no CPU-only tag; torch CPU is installed via pip below
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=600 -r requirements.txt

# Pre-download ML models at build time so startup is fast
# Without this, models download on first request and health checks time out
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
RUN python -c "from sentence_transformers import CrossEncoder; CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

# Copy application code
COPY main.py .

# Expose port
EXPOSE 8002

# Start service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]