# syntax=docker/dockerfile:1

FROM node:14.17.3

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install

COPY . .

CMD [ "node", "index.js" ]