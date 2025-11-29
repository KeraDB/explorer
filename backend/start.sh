#!/bin/bash
# Start keradb Labs Backend Server

# Add Rust to PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Navigate to backend directory
cd "$(dirname "$0")"

echo "======================================"
echo "keradb Labs Backend Server"
echo "======================================"
echo ""

# Check if release binary exists
if [ ! -f "target/release/keradb-labs" ]; then
    echo "Building release binary..."
    cargo build --release
    echo ""
fi

echo "Starting server on http://localhost:5800"
echo "Press Ctrl+C to stop"
echo ""

# Run the server
RUST_LOG=info cargo run --release
