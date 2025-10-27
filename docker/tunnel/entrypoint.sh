#!/bin/sh

# Configuration
TARGET_HOST="${TARGET_HOST:-app}"
TARGET_PORT="${TARGET_PORT:-3000}"
TUNNEL_SUBDOMAIN="${TUNNEL_SUBDOMAIN:-ifirmasync}"

echo "========================================="
echo "LocalTunnel Service"
echo "========================================="
echo "Target: ${TARGET_HOST}:${TARGET_PORT}"
echo "Subdomain: ${TUNNEL_SUBDOMAIN}"

# Detect public IP
echo "Detecting public IP..."
PUBLIC_IP=$(wget -qO- --timeout=5 https://api.ipify.org 2>/dev/null || \
            wget -qO- --timeout=5 https://checkip.amazonaws.com 2>/dev/null | tr -d '\n' || \
            wget -qO- --timeout=5 https://icanhazip.com 2>/dev/null | tr -d '\n' || \
            echo "unknown")
# Trim whitespace and validate it's an IP
PUBLIC_IP=$(echo "${PUBLIC_IP}" | tr -d '[:space:]')
echo "Public IP: ${PUBLIC_IP}"
echo "Container IP: $(hostname -i 2>/dev/null || echo "unknown")"

echo "========================================="

# Function to start localtunnel
start_tunnel() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting localtunnel..."

    # Build the lt command
    LT_CMD="lt --local-host ${TARGET_HOST} --port ${TARGET_PORT}"

    # Add subdomain only if specified and not empty
    if [ -n "${TUNNEL_SUBDOMAIN}" ] && [ "${TUNNEL_SUBDOMAIN}" != "random" ]; then
        LT_CMD="${LT_CMD} --subdomain ${TUNNEL_SUBDOMAIN}"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Requesting subdomain: ${TUNNEL_SUBDOMAIN}"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Using random subdomain"
    fi

    # Start localtunnel with local-host and optional subdomain
    # Note: --local-host is used to specify the target host within the container network
    eval $LT_CMD 2>&1 | while IFS= read -r line; do
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${line}"

        # Highlight the tunnel URL
        if echo "$line" | grep -q "your url is:"; then
            TUNNEL_URL=$(echo "$line" | grep -o 'https://[^ ]*')
            echo "========================================="
            echo "TUNNEL URL: ${TUNNEL_URL}"
            echo ""
            echo "IMPORTANT: To access the web interface:"
            echo "1. Visit: ${TUNNEL_URL}"
            echo "2. Enter the PUBLIC IP when prompted: ${PUBLIC_IP}"
            echo ""
            echo "Configure webhook in app/.env:"
            echo "WEBHOOK_URL=${TUNNEL_URL}/webhook/drive"
            echo "========================================="
        fi
    done

    return $?
}

# Main loop with reconnection logic
while true; do
    start_tunnel
    EXIT_CODE=$?

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tunnel closed (exit code: ${EXIT_CODE})"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Reconnecting in 5 seconds..."
    sleep 5
done