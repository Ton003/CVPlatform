# Stage 1 — Build Angular app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2 — Serve with Nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Add our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy Angular build output
# Angular 17 with @angular/build outputs to dist/frontend/browser
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]