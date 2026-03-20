FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN mkdir -p /app/data /app/logs

EXPOSE 3000

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV CONFIG_FILE=/app/config/events.json

CMD ["node", "src/index.js"]
