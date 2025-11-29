# System Database Bug Fix

## Issue
The system database was generating warnings when trying to update connection statistics:

```
[2025-11-04T13:22:06Z WARN  keradb_labs] Failed to update connection stats: Document not found: 
[2025-11-04T13:22:18Z WARN  keradb_labs] Failed to register connection in system db: Document not found: 
[2025-11-04T13:22:18Z WARN  keradb_labs] Failed to update connection stats: Document not found: 
```

## Root Cause

The problem was in the deserialization logic in `system_db.rs`. When deserializing documents from the keradb database:

1. **Documents include `_id` field**: keradb automatically adds an `_id` field to all documents
2. **Struct mismatch**: The `DatabaseConnection` and `PerformanceMetric` structs didn't account for this extra field
3. **Deserialization failure**: `serde_json::from_value()` was trying to map `_id` to the struct's `id` field, causing confusion

## The Fix

### 1. Updated `find_connection_by_path()` signature

**Before:**
```rust
fn find_connection_by_path(&self, path: &str) 
    -> Result<DatabaseConnection, Box<dyn std::error::Error>>
```

**After:**
```rust
fn find_connection_by_path(&self, path: &str) 
    -> Result<(String, DatabaseConnection), Box<dyn std::error::Error>>
```

Now it returns a tuple with:
- The document's `_id` (needed for updates/deletes)
- The deserialized connection object

### 2. Fixed deserialization logic

**Before:**
```rust
let conn: DatabaseConnection = serde_json::from_value(doc.to_value())?;
```

**After:**
```rust
let doc_value = doc.to_value();

// Extract the _id separately
let doc_id = doc_value.get("_id")
    .and_then(|v| v.as_str())
    .ok_or("Missing _id field")?
    .to_string();

// Deserialize the connection (serde ignores unknown fields by default)
let conn: DatabaseConnection = serde_json::from_value(doc_value)?;
```

### 3. Updated all methods to use new signature

Updated these methods to properly handle the document ID:
- `register_connection()` - Now properly updates existing connections
- `update_connection_stats()` - Uses the correct document ID
- `remove_connection()` - Uses the correct document ID
- `list_connections()` - Gracefully handles deserialization errors
- `get_metrics()` - Gracefully handles deserialization errors

## Changes Made

### File: `src/system_db.rs`

1. **`find_connection_by_path()`** - Returns `(String, DatabaseConnection)` tuple
2. **`register_connection()`** - Updated to use new tuple format
3. **`update_connection_stats()`** - Updated to use new tuple format
4. **`remove_connection()`** - Updated to use new tuple format
5. **`list_connections()`** - Added error handling for deserialization
6. **`get_metrics()`** - Added error handling for deserialization

## Testing

After the fix, the server should start without warnings:

```bash
cd keradb-labs/backend
cargo run
```

Expected output (no warnings):
```
[2025-11-04T13:30:00Z INFO  keradb_labs] System database initialized
[2025-11-04T13:30:00Z INFO  keradb_labs] Starting keradb Labs API server on http://localhost:5800
[2025-11-04T13:30:00Z INFO  actix_server::builder] starting 24 workers
[2025-11-04T13:30:00Z INFO  actix_server::server] Actix runtime found; starting in Actix runtime
[2025-11-04T13:30:00Z INFO  actix_server::server] starting service: "actix-web-service-127.0.0.1:5800", workers: 24, listening on: 127.0.0.1:5800
```

Test with:
```bash
# Create a database
curl -X POST http://localhost:5800/api/databases/create \
  -H "Content-Type: application/json" \
  -d '{"path": "./test.db"}'

# Check system stats (should work without errors)
curl http://localhost:5800/api/system/stats | jq
```

## Why This Works

1. **Separate ID extraction**: We extract the `_id` field before deserialization
2. **Serde default behavior**: Serde's default behavior is to ignore unknown fields, but having both `_id` and `id` was causing conflicts
3. **Explicit error handling**: Using `if let Ok()` for deserialization prevents single bad documents from breaking the entire query
4. **Proper ID usage**: Using the actual document ID for updates/deletes ensures we're modifying the right document

## Additional Improvements

The fix also includes:
- Better error handling with graceful degradation
- More robust deserialization that won't fail on unexpected fields
- Clearer separation between document IDs and connection IDs

## Verification

To verify the fix is working:

1. Start the server
2. Open/create multiple databases
3. Check the logs - no warnings should appear
4. Query system stats:
   ```bash
   curl http://localhost:5800/api/system/stats
   ```
5. Verify connections are properly tracked with correct metadata

The system database should now work flawlessly! 🎉
