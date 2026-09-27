ARG ELIXIR_VERSION=1.17.3
ARG OTP_VERSION=27.3.4.18
ARG DEBIAN_VERSION=bookworm-20260918-slim

ARG BUILDER_IMAGE="docker.io/hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="docker.io/debian:${DEBIAN_VERSION}"

FROM node:20-alpine AS frontend-builder
WORKDIR /app/client

ARG VITE_API_BASE_URL=http://localhost:4000
ARG VITE_CAFE_NAME="Sushi Like"

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CAFE_NAME=$VITE_CAFE_NAME

COPY client/package.json client/pnpm-lock.yaml* client/package-lock.json* ./
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate
RUN pnpm install --no-frozen-lockfile --loglevel debug

COPY client/ ./
RUN pnpm build || npm run build

FROM ${BUILDER_IMAGE} AS backend-builder
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

FROM ${RUNNER_IMAGE}
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libstdc++6 openssl libncurses5 locales ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN sed -i '/en_US.UTF-8/s/^# //' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8 LANGUAGE=en_US:C.UTF-8 LC_ALL=en_US.UTF-8 \
    MIX_ENV=prod

COPY --from=backend-builder /app/server/_build/prod/rel/delivest ./

RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'echo "Running database migrations..."' >> /app/entrypoint.sh && \
    echo 'bin/delivest eval "Delivest.Release.migrate" || true' >> /app/entrypoint.sh && \
    echo 'echo "Running role seeds..."' >> /app/entrypoint.sh && \
    echo 'bin/delivest delivest.seed_roles || true' >> /app/entrypoint.sh && \
    echo 'echo "Starting Delivest server..."' >> /app/entrypoint.sh && \
    echo 'exec bin/delivest start' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh
    
EXPOSE 4000
ENV PORT=4000

CMD ["bin/delivest", "start"]