FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy all server files
COPY server.js .
COPY .sequelizerc .
COPY config/ ./config/
COPY models/ ./models/
COPY migrations/ ./migrations/

EXPOSE 3000

CMD ["node", "server.js"]