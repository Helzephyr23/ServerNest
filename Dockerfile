FROM node:20-alpine AS base

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY src/package.json ./src/

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile

COPY src/ ./src/

WORKDIR /app/src
RUN pnpm build

EXPOSE 3001

CMD ["node", "dist/index.js"]
