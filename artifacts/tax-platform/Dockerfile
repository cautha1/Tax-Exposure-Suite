FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NODE_ENV=production

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/tax-platform run build

FROM nginx:1.27-alpine AS runner

COPY artifacts/tax-platform/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/artifacts/tax-platform/dist/public /usr/share/nginx/html

EXPOSE 80
