# syntax=docker/dockerfile:1

# --- deps: installa tutte le dipendenze (servono anche le dev per il build) ---
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: genera il client Prisma e compila Next (output standalone) ---
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runner: immagine finale snella ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Server standalone di Next (include i node_modules tracciati, tra cui @prisma/client)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Client Prisma generato (.prisma) + @prisma/client: usati a runtime dall'app.
# Copiati esplicitamente per garantire la presenza del query engine nel bundle standalone.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Schema + migrazioni per `migrate deploy`.
COPY --from=builder /app/prisma ./prisma

# CLI Prisma per le migrazioni: installazione pulita così npm risolve tutto
# l'albero di dipendenze del CLI (evita il cherry-pick dei singoli pacchetti).
RUN npm install prisma@6.19.3 --no-audit --no-fund --no-save

EXPOSE 3000

# Applica le migrazioni e avvia il server.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
