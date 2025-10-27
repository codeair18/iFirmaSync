FROM node:lts-alpine

# Install required tools
RUN apk add --no-cache curl wget

# Install localtunnel globally
RUN npm install -g localtunnel

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]