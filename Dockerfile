FROM node:20-alpine AS base

WORKDIR /app

<<<<<<< Updated upstream
COPY package.json pnpm-workspace.yaml ./
=======
# Copy root config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY .env.example ./.env.example

# Copy all package.json files
>>>>>>> Stashed changes
COPY src/package.json ./src/

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile

COPY src/ ./src/

WORKDIR /app/src
RUN pnpm build

EXPOSE 3001

<<<<<<< Updated upstream
CMD ["node", "dist/index.js"]
=======
WORKDIR /app

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000 3001

CMD ["sh", "-c", "node /app/src/dist/index.js & (cd /app/web && pnpm exec next start --hostname 0.0.0.0 --port 3000) & wait"]
>>>>>>> Stashed changes
