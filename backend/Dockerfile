# Build context is the backend/ folder:  docker build -t pocketbudz-api backend
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json ./
# generate only reads the schema; the URL just has to exist for prisma.config.ts
RUN DATABASE_URL=postgresql://build:build@localhost/build npx prisma generate
COPY src ./src
RUN npx tsc -p tsconfig.build.json

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL=postgresql://build:build@localhost/build npx prisma generate
COPY --from=build /app/dist ./dist
USER node
# Cloud Run sets PORT; the server reads it.
CMD ["node", "dist/server.js"]
