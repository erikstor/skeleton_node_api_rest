FROM node:alpine

#FROM node:lts
WORKDIR /app
ENV TZ America/Bogota
COPY package.json .
RUN yarn install --production=true
COPY . .
EXPOSE 5555
CMD [ "node", "./src/index.js" ]


