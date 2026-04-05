FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run prisma:generate && npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
