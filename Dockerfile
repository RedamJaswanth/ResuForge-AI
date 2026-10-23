FROM python:3.11-slim

# Create non-root user (UID 1000) for Hugging Face Spaces compatibility
RUN useradd -m -u 1000 user

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy all project files and set ownership
COPY --chown=user:user . .

USER user

# Hugging Face Spaces listens on port 7860 by default
ENV PORT=7860 \
    HOST=0.0.0.0 \
    PYTHONUNBUFFERED=1

EXPOSE 7860

# Launch FastAPI app with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
