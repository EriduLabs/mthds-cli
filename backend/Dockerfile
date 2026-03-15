# Pull the official Python base image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Django project
COPY . .

# Expose the port Cloud Run expects
EXPOSE 8080

# Command to run the Django app using Daphne (ASGI) to support WebSockets
CMD ["daphne", "-b", "0.0.0.0", "-p", "8080", "config.asgi:application"]
