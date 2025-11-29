# System Database

The keradb Labs backend includes a **system database** that automatically tracks all database connections, metadata, and performance metrics.

## Features

### 🗂️ Connection Tracking
- Automatically registers all opened/created databases
- Tracks creation time and last access time
- Counts total access attempts per database
- Stores collection and document counts

### 📊 Performance Metrics
- Records operation durations (open, create, insert, etc.)
- Timestamps for all operations
- Historical performance data for analysis

### 📍 OS-Agnostic Storage
The system database is stored in a platform-independent location:
- **Windows**: `%USERPROFILE%\.keradb\.keradb_system.db`
- **Linux/Mac**: `$HOME/.keradb/.keradb_system.db`

## API Endpoints

### System Statistics
```http
GET /api/system/stats
```
Returns overall system statistics including:
- Total number of databases
- Total collections across all databases
- Total documents
- List of all registered connections

**Example Response:**
```json
{
  "total_databases": 5,
  "total_collections": 12,
  "total_documents": 1523,
  "connections": [
    {
      "id": "conn_123",
      "path": "/path/to/database.db",
      "created_at": "2025-11-04T10:30:00Z",
      "last_accessed": "2025-11-04T14:25:00Z",
      "access_count": 42,
      "collections_count": 3,
      "total_documents": 150
    }
  ]
}
```

### Connection History
```http
GET /api/system/connections
```
Lists all database connections sorted by last accessed time (most recent first).

**Example Response:**
```json
[
  {
    "id": "conn_456",
    "path": "/var/data/production.db",
    "created_at": "2025-11-01T08:00:00Z",
    "last_accessed": "2025-11-04T15:00:00Z",
    "access_count": 156,
    "collections_count": 5,
    "total_documents": 8500
  }
]
```

### Database Metrics
```http
GET /api/system/metrics/{database_path}?limit=100
```
Retrieves performance metrics for a specific database.

**Query Parameters:**
- `limit` (optional): Maximum number of metrics to return

**Example Response:**
```json
[
  {
    "id": "metric_789",
    "database_path": "/path/to/db.db",
    "operation": "insert_document",
    "duration_ms": 15,
    "timestamp": "2025-11-04T15:30:00Z"
  },
  {
    "id": "metric_790",
    "database_path": "/path/to/db.db",
    "operation": "open_database",
    "duration_ms": 8,
    "timestamp": "2025-11-04T15:29:45Z"
  }
]
```

### Remove Connection
```http
DELETE /api/system/connections/{database_path}
```
Removes a database connection from the system database and closes it.

**Example Response:**
```json
{
  "message": "Connection removed",
  "path": "/path/to/database.db"
}
```

## Data Models

### DatabaseConnection
```rust
{
    id: String,              // Unique identifier
    path: String,            // Full path to database file
    created_at: DateTime,    // When first registered
    last_accessed: DateTime, // Last access timestamp
    access_count: u64,       // Number of times accessed
    collections_count: usize,// Number of collections
    total_documents: usize,  // Total documents across all collections
}
```

### PerformanceMetric
```rust
{
    id: String,              // Unique identifier
    database_path: String,   // Associated database path
    operation: String,       // Operation type (e.g., "insert_document")
    duration_ms: u64,        // Operation duration in milliseconds
    timestamp: DateTime,     // When the operation occurred
}
```

## Implementation Details

### Automatic Registration
Every time a database is opened or created via the API, it's automatically:
1. Registered in the system database (if new)
2. Access count incremented
3. Last accessed timestamp updated
4. Statistics refreshed

### Performance Tracking
Selected operations are automatically tracked:
- `open_database` - Opening an existing database
- `create_database` - Creating a new database
- `insert_document` - Inserting a document

Additional operations can be tracked by adding metric recording calls.

### Thread Safety
The system database uses the same thread-safe mechanisms as regular databases:
- Arc for shared ownership
- RwLock for concurrent access
- All operations are atomic

## Usage Example

### Opening a database and viewing system stats

```bash
# Open a database
curl -X POST http://localhost:5800/api/databases/open \
  -H "Content-Type: application/json" \
  -d '{"path": "./mydata.db"}'

# Check system statistics
curl http://localhost:5800/api/system/stats

# View connection history
curl http://localhost:5800/api/system/connections

# Get performance metrics for specific database
curl "http://localhost:5800/api/system/metrics/./mydata.db?limit=50"
```

## Benefits

1. **Persistence**: Connection history survives server restarts
2. **Analytics**: Track database usage patterns over time
3. **Monitoring**: Identify slow operations and performance bottlenecks
4. **Audit Trail**: Complete history of database access
5. **Management**: Easy cleanup of old/unused database connections

## Future Enhancements

Potential additions to the system database:
- Query statistics and patterns
- Storage size tracking
- Automatic cleanup of stale connections
- Alert thresholds for performance
- Index usage statistics
- User access tracking (with authentication)
- Backup/restore metadata
