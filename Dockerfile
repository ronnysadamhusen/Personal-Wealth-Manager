# ===================================================================
# STAGE 1: Build the React + Vite + TypeScript Frontend
# ===================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy dependencies config
COPY frontend/package*.json ./
RUN npm install

# Copy all frontend source files and compile
COPY frontend/ ./
RUN npm run build

# ===================================================================
# STAGE 2: Install Backend Dependencies & Run the Unified Server
# ===================================================================
FROM node:20 AS runtime
WORKDIR /app

# SQLite3 requires python/make/g++ to build native code on some environments.
# Using standard node:20 includes build essentials for smooth native building.
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source files
COPY backend/database.js ./
COPY backend/pdfParser.js ./
COPY backend/server.js ./

# Copy compiled frontend from Stage 1 into the public static folder
COPY --from=frontend-builder /app/frontend/dist ./public

# Setup SQLite storage folder
RUN mkdir -p /app/data
ENV PORT=3000
EXPOSE 3000

# Mountable volume for database persistence
VOLUME ["/app/data"]

CMD ["node", "server.js"]
