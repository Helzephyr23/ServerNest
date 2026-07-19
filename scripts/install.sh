#!/bin/bash
set -e

echo "🍛 Installing Biryani - Minecraft Server Panel"
echo "=============================================="

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Error: Docker is required. Install it from https://docker.com"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Error: Git is required."; exit 1; }

# Clone repo
INSTALL_DIR="${BIRYANI_DIR:-$HOME/biryani}"
if [ -d "$INSTALL_DIR" ]; then
  echo "Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull
else
  echo "Cloning Biryani to $INSTALL_DIR..."
  git clone https://github.com/Helzephyr23/biryani.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Setup env
if [ ! -f .env ]; then
  cp .env.example .env
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  sed -i.bak "s/change-me-to-a-random-string/$JWT_SECRET/" .env
  rm -f .env.bak
  echo "Created .env with secure JWT_SECRET"
fi

# Start with Docker
echo "Starting Biryani..."
docker compose up -d

echo ""
echo "✅ Biryani is running!"
echo "   Panel:  http://localhost:3000"
echo "   API:    http://localhost:3001"
echo ""
echo "Open the panel in your browser and create your admin account."
