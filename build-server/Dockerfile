FROM node:latest

WORKDIR /app

RUN apt-get update 
RUN apt-get install -y git 

COPY main.sh main.sh
COPY script.js script.js
COPY package*.json .

RUN npm install

RUN chmod +x main.sh
RUN chmod +x script.js

ENTRYPOINT [ "/app/main.sh" ]
