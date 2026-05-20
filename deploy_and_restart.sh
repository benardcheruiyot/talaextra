#!/bin/bash
# Automated deployment and PM2 restart script for talaextra backend

# Set your project directory here:
PROJECT_DIR="/Users/bcher/talaextra"  # <-- Set to your actual project path

cd "$PROJECT_DIR" || { echo "Project directory not found!"; exit 1; }

echo "Pulling latest code from GitHub..."
git pull origin main

echo "Installing backend dependencies..."
npm install --prefix backend

echo "Restarting backend with PM2..."
pm2 restart all

echo "Deployment and restart complete!"
