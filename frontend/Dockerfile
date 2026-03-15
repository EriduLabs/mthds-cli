# Pull the official Node base image
FROM node:20-alpine as build

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package.json package-lock.json ./

# Install dependencies (using npm install because package-lock.json was not generated yet in the repo, otherwise use npm ci)
RUN npm install

# Copy the rest of the frontend source code
COPY . .

# Build the frontend application for production
RUN npm run build

# Use Nginx to serve the built static files
FROM nginx:alpine

# Copy the build output from the builder stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port (Cloud Run defaults to 8080)
EXPOSE 8080

# Configure Nginx for React Router and Cloud Run's port 8080
RUN sed -i 's/listen  *80;/listen 8080;/' /etc/nginx/conf.d/default.conf
RUN sed -i '/index  index.html index.htm;/a \        try_files $uri $uri/ /index.html;' /etc/nginx/conf.d/default.conf

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
