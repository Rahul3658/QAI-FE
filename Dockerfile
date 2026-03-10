# ---------- Stage 1 : Build React App ----------
FROM node:20.8.0 AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . .

# Build React app
RUN npm run build


# ---------- Stage 2 : Production Server ----------
FROM nginx:alpine

# Copy build files to nginx html directory
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
