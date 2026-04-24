# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm install --legacy-peer-deps --silent

# Build args — baked into the static bundle at build time
ARG REACT_APP_API_BASE_URL=http://localhost:5004
ARG REACT_APP_LOAN_SERVICE_BASE_URL=http://localhost:5130
ARG REACT_APP_EXPRESSION_API_URL=http://localhost:5004
ARG REACT_APP_DYNAMIC_FORMS_API_URL=http://localhost:5013
ARG REACT_APP_UAM_BASE_URL=http://localhost:5033

ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
ENV REACT_APP_LOAN_SERVICE_BASE_URL=$REACT_APP_LOAN_SERVICE_BASE_URL
ENV REACT_APP_EXPRESSION_API_URL=$REACT_APP_EXPRESSION_API_URL
ENV REACT_APP_DYNAMIC_FORMS_API_URL=$REACT_APP_DYNAMIC_FORMS_API_URL
ENV REACT_APP_UAM_BASE_URL=$REACT_APP_UAM_BASE_URL
# Give Node.js enough heap for the CRA/CRACO build
ENV NODE_OPTIONS=--max-old-space-size=3072
# Reduce webpack memory: skip source maps and ESLint (saves 300-500 MB)
ENV GENERATE_SOURCEMAP=false
ENV DISABLE_ESLINT_PLUGIN=true

COPY . .
RUN npm run build

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
