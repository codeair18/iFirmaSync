FROM node:lts-alpine

WORKDIR /usr/src/app

EXPOSE 3000

CMD ["tail", "-f", "/dev/null"]