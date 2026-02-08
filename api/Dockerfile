FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc
ENV PORT=3000
ENV RPC_URL=https://api.devnet.solana.com
EXPOSE 3000
CMD ["node", "dist/index.js"]
