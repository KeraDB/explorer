#!/bin/bash
# Start NoSQLite Labs Frontend

# Navigate to frontend directory
cd "$(dirname "$0")"

echo "======================================"
echo "NoSQLite Labs Frontend"
echo "======================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "Starting frontend server on http://localhost:5810"
echo "Make sure backend is running on http://localhost:5800"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the dev server
npm run dev
