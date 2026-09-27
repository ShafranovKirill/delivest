ARG ELIXIR_VERSION=1.17.4
ARG OTP_VERSION=27.1.2
ARG DEBIAN_VERSION=bookworm-slim

FROM node:20-alpine AS frontend-builder
WORKDIR /app/client

ARG VITE_API_BASE_URL=http://localhost:4000
ARG VITE_CAFE_NAME="Sushi Like"

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CAFE_NAME=$VITE_CAFE_NAME

COPY client/package.json client/pnpm-lock.yaml* client/package-lock.json* ./
RUN corepack enable && (pnpm install --frozen-lockfile || npm install)

COPY client/ ./
RUN pnpm build || npm run build

FROM hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION} AS backend-builder
WORKDIR /app/server

RUN apt-get update && apt-get install -y build-essential git && rm -rf /var/lib/apt/lists/*
ENV MIX_ENV=prod

RUN mix local.hex --force && mix local.rebar --force

COPY server/mix.exs server/mix.lock ./
RUN mix deps.get --only prod
RUN mix deps.compile

COPY server/priv priv
COPY server/lib lib
COPY server/config config

COPY --from=frontend-builder /app/client/dist ./priv/static

RUN mix compile
RUN mix release

FROM debian:${DEBIAN_VERSION}
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libstdc++6 openssl libncurses5 locales ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN sed -i '/en_US.UTF-8/s/^# //' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8 LANGUAGE=en_US:C.UTF-8 LC_ALL=en_US.UTF-8 \
    MIX_ENV=prod

COPY --from=backend-builder /app/server/_build/prod/rel/delivest ./

EXPOSE 4000
ENV PORT=4000

CMD ["bin/delivest", "start"]