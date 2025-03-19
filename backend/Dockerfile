FROM node:22.14.0-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 40030

CMD ["npm", "start"] 