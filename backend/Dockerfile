# --------- BUILD STAGE ---------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Install ALL deps (including dev)
RUN npm ci --legacy-peer-deps

COPY . .

# Build the app
RUN npm run build


# --------- PRODUCTION STAGE ---------
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Install ONLY production deps
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built app from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Fixed command: use start:prod or direct node call
CMD ["npm", "run", "start:prod"]