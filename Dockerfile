# 1. Frontend Build Stage
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies first for better caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Build the frontend
COPY frontend/ .
RUN npm run build

# 2. Backend Production Stage
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn whitenoise

# Copy backend code
COPY backend/ /app/backend/

# Copy the frontend build artifacts from Stage 1 into the backend's frontend_build directory
COPY --from=frontend-builder /app/backend/frontend_build /app/backend/frontend_build

# Set the working directory to the backend so manage.py operates correctly
WORKDIR /app/backend

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose the port Cloud Run uses
EXPOSE 8080

# Command to run gunicorn
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8080"]
