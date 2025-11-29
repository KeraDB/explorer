#!/bin/bash
# Helper script to access the keradb Labs database
# This handles the Windows path issue in WSL

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
keradb_BIN="$SCRIPT_DIR/../../target/release/keradb"

# The actual database file (with Windows path as filename - this was created by the frontend)
DB_FILE_WITH_WINDOWS_PATH="D:\\TopSecret\\keradb\\keradb-labs\\backend\\db1"

echo "========================================"
echo "keradb Labs Database Access"
echo "========================================"
echo ""
echo "📁 Database file: $DB_FILE_WITH_WINDOWS_PATH"
echo "🔧 Binary: $keradb_BIN"
echo ""
echo "Note: The frontend created a database file with a Windows path as its"
echo "      filename. This script accesses that specific file."
echo ""

# Check if keradb binary exists
if [ ! -f "$keradb_BIN" ]; then
    echo "❌ Error: keradb binary not found at $keradb_BIN"
    echo "Please build keradb first: cargo build --release"
    exit 1
fi

cd "$SCRIPT_DIR"

# Check if database file exists
if [ ! -f "$DB_FILE_WITH_WINDOWS_PATH" ]; then
    echo "❌ Error: Database file not found!"
    echo "Available database files in this directory:"
    ls -lh *.db* db* 2>/dev/null | grep -v "^d" || echo "  (none found)"
    exit 1
fi

echo "✅ Opening database..."
echo ""

# Run keradb shell
"$keradb_BIN" shell "$DB_FILE_WITH_WINDOWS_PATH"
