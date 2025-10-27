FROM node:lts-alpine

WORKDIR /usr/src/app


EXPOSE 3000

# Run both start and source:watch scripts concurrently
ENTRYPOINT ["sh", "-c", "npm run start & npm run source:watch & wait"]
