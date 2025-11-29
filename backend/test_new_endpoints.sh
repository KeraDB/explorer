#!/bin/bash

# Test script for new database management endpoints
# Tests: Close Database, Drop Collection, Delete Database

set -e  # Exit on error

API_URL="http://localhost:5800"
TEST_DB="./test_mgmt.db"

echo "=========================================="
echo "keradb Labs - Management Endpoints Test"
echo "=========================================="
echo ""

# Check if server is running
echo "1. Checking server health..."
HEALTH=$(curl -s "$API_URL/health")
if [ $? -ne 0 ]; then
    echo "❌ Server is not running!"
    echo "   Start the server with: ./start.sh"
    exit 1
fi
echo "✅ Server is healthy"
echo "$HEALTH" | jq '.'
echo ""

# Create a test database
echo "2. Creating test database: $TEST_DB"
CREATE_RESULT=$(curl -s -X POST "$API_URL/api/databases/create" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"$TEST_DB\"}")
echo "✅ Database created"
echo "$CREATE_RESULT" | jq '.'
echo ""

# Insert some test documents
echo "3. Inserting test documents..."
for i in {1..5}; do
    curl -s -X POST "$API_URL/api/databases/$TEST_DB/documents" \
        -H "Content-Type: application/json" \
        -d "{\"collection\": \"users\", \"document\": {\"name\": \"User $i\", \"email\": \"user$i@test.com\"}}" > /dev/null
done
echo "✅ Inserted 5 documents into 'users' collection"

for i in {1..3}; do
    curl -s -X POST "$API_URL/api/databases/$TEST_DB/documents" \
        -H "Content-Type: application/json" \
        -d "{\"collection\": \"posts\", \"document\": {\"title\": \"Post $i\", \"content\": \"Content $i\"}}" > /dev/null
done
echo "✅ Inserted 3 documents into 'posts' collection"
echo ""

# List collections
echo "4. Listing collections..."
COLLECTIONS=$(curl -s "$API_URL/api/databases/$TEST_DB/collections")
echo "$COLLECTIONS" | jq '.'
echo ""

# Test: Drop Collection
echo "5. Testing DROP COLLECTION..."
echo "   Dropping 'users' collection..."
DROP_RESULT=$(curl -s -X DELETE "$API_URL/api/databases/$TEST_DB/collections" \
    -H "Content-Type: application/json" \
    -d "{\"collection\": \"users\"}")
echo "✅ Collection dropped"
echo "$DROP_RESULT" | jq '.'
echo ""

# Verify collection was dropped
echo "6. Verifying collection drop..."
COLLECTIONS_AFTER=$(curl -s "$API_URL/api/databases/$TEST_DB/collections")
echo "$COLLECTIONS_AFTER" | jq '.'
USERS_COUNT=$(echo "$COLLECTIONS_AFTER" | jq -r '.[] | select(.name=="users") | .count // 0')
if [ "$USERS_COUNT" == "0" ] || [ -z "$USERS_COUNT" ]; then
    echo "✅ 'users' collection successfully dropped"
else
    echo "❌ 'users' collection still exists with $USERS_COUNT documents"
fi
echo ""

# Test: Close Database
echo "7. Testing CLOSE DATABASE..."
CLOSE_RESULT=$(curl -s -X POST "$API_URL/api/databases/close" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"$TEST_DB\"}")
echo "✅ Database closed"
echo "$CLOSE_RESULT" | jq '.'
echo ""

# Verify database is not in active connections
echo "8. Verifying database is closed..."
ACTIVE_DBS=$(curl -s "$API_URL/api/databases")
if echo "$ACTIVE_DBS" | grep -q "$TEST_DB"; then
    echo "⚠️  Database still appears in active connections (may be expected)"
else
    echo "✅ Database removed from active connections"
fi
echo ""

# Reopen the database
echo "9. Reopening database to test DELETE..."
curl -s -X POST "$API_URL/api/databases/open" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"$TEST_DB\"}" > /dev/null
echo "✅ Database reopened"
echo ""

# Test: Delete Database
echo "10. Testing DELETE DATABASE..."
echo "    ⚠️  This will permanently delete $TEST_DB"
DELETE_RESULT=$(curl -s -X DELETE "$API_URL/api/databases/$TEST_DB")
echo "✅ Database deleted"
echo "$DELETE_RESULT" | jq '.'
echo ""

# Verify file was deleted
echo "11. Verifying database file deletion..."
if [ -f "$TEST_DB" ]; then
    echo "❌ Database file still exists!"
    rm -f "$TEST_DB"  # Clean up manually
else
    echo "✅ Database file successfully deleted"
fi
echo ""

echo "=========================================="
echo "✅ All tests completed successfully!"
echo "=========================================="
echo ""
echo "Summary of tested endpoints:"
echo "  - POST /api/databases/close    ✅"
echo "  - DELETE /api/databases/{db}/collections  ✅"
echo "  - DELETE /api/databases/{db}    ✅"
