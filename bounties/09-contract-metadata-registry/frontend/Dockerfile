FROM node:20

WORKDIR /app

# Build args for Next.js NEXT_PUBLIC_* (baked in at build time)
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/v1
ARG NEXT_PUBLIC_REGISTRY_ADDRESS=
ARG NEXT_PUBLIC_CONFLUX_RPC_URL=https://evmtestnet.confluxrpc.com
ARG NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_REGISTRY_ADDRESS=$NEXT_PUBLIC_REGISTRY_ADDRESS \
    NEXT_PUBLIC_CONFLUX_RPC_URL=$NEXT_PUBLIC_CONFLUX_RPC_URL \
    NEXT_PUBLIC_IPFS_GATEWAY=$NEXT_PUBLIC_IPFS_GATEWAY

COPY package.json yarn.lock* package-lock.json* ./
RUN if [ -f yarn.lock ]; then yarn install; else npm install; fi

COPY . .

RUN npm run build

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start"]

