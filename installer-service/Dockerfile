# Explicit, single-stage build - Railway's auto-detected Railpack build
# (separate builder/runtime base images) was not reliably carrying
# node_modules into the runtime image for this service, causing
# "Cannot find module 'helmet'" at startup despite npm install
# succeeding during the build. A Dockerfile is auto-preferred by Railway
# over Railpack when present, and a single stage removes that class of
# bug entirely - node_modules is installed and used in the same image.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "index.js"]
