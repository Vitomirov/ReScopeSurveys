FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js postcss.config.js tailwind.config.js jsconfig.json ./
COPY public ./public
COPY shared ./shared
COPY src ./src

ARG VITE_USE_API=true
ENV VITE_USE_API=$VITE_USE_API
ARG VITE_PANEL_URL=
ENV VITE_PANEL_URL=$VITE_PANEL_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=10s \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
