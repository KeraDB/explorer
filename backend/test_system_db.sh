#!/bin/bash

# Test script for System Database functionality

API_URL="http://localhost:5800"

echo "========================================"
echo "keradb Labs - System Database Tests"
echo "========================================"
echo ""

# Check health
echo "1. Checking server health..."
curl -s "$API_URL/health" | jq '.'
echo ""

# Create a test database
echo "2. Creating test database..."
curl -s -X POST "$API_URL/api/databases/create" \
  -H "Content-Type: application/json" \
  -d '{"path": "./test_db1.db"}' | jq '.'
echo ""

# Open another database
echo "3. Opening another database..."
curl -s -X POST "$API_URL/api/databases/open" \
  -H "Content-Type: application/json" \
  -d '{"path": "./test_db2.db"}' | jq '.'
echo ""

# Check system stats
echo "4. Getting system statistics..."
curl -s "$API_URL/api/system/stats" | jq '.'
echo ""

# Get connection history
echo "5. Getting connection history..."
curl -s "$API_URL/api/system/connections" | jq '.'
echo ""

# Insert some documents to generate metrics
echo "6. Inserting test documents..."
curl -s -X POST "$API_URL/api/databases/test_db1.db/documents" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "users",
    "document": {"name": "Alice", "age": 30}
  }' | jq '.'
echo ""

curl -s -X POST "$API_URL/api/databases/test_db1.db/documents" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "users",
    "document": {"name": "Bob", "age": 25}
  }' | jq '.'
echo ""

# Get metrics for test_db1
echo "7. Getting performance metrics for test_db1.db..."
curl -s "$API_URL/api/system/metrics/./test_db1.db?limit=10" | jq '.'
echo ""

# Get database stats
echo "8. Getting database stats..."
curl -s "$API_URL/api/databases/test_db1.db/stats" | jq '.'
echo ""

# Final system stats
echo "9. Final system statistics..."
curl -s "$API_URL/api/system/stats" | jq '.'
echo ""

echo "========================================"
echo "System database location:"
echo "Windows: %USERPROFILE%\\.keradb\\.keradb_system.db"
echo "Linux/Mac: \$HOME/.keradb/.keradb_system.db"
echo "========================================"
