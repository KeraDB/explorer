# System Database Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      keradb Labs API Server                    │
│                         (Port 5800)                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼────────┐       ┌───────▼────────┐
        │  User Databases │       │  System Database│
        │  (Tracked DBs)  │       │  (Metadata DB)  │
        └───────┬────────┘       └───────┬────────┘
                │                         │
     ┌──────────┼──────────┐             │
     │          │          │             │
┌────▼───┐ ┌───▼────┐ ┌───▼────┐       │
│ db1.db │ │ db2.db │ │ db3.db │       │
│        │ │        │ │        │       │
│ • coll1│ │ • users│ │ • logs │       │
│ • coll2│ │ • posts│ │ • audit│       │
└────────┘ └────────┘ └────────┘       │
                                        │
                            ┌───────────▼──────────────┐
                            │ ~/.keradb/             │
                            │   .keradb_system.db    │
                            │                          │
                            │ Collections:             │
                            │ ┌────────────────────┐   │
                            │ │  connections       │   │
                            │ │  • path           │   │
                            │ │  • created_at     │   │
                            │ │  • access_count   │   │
                            │ │  • stats          │   │
                            │ └────────────────────┘   │
                            │ ┌────────────────────┐   │
                            │ │  metrics           │   │
                            │ │  • operation      │   │
                            │ │  • duration_ms    │   │
                            │ │  • timestamp      │   │
                            │ └────────────────────┘   │
                            └──────────────────────────┘
```

## Data Flow

### Opening a Database
```
Client Request
    │
    ▼
POST /api/databases/open {"path": "./db1.db"}
    │
    ├──► Open/Create Database
    │
    ├──► Register in System DB (connections collection)
    │     • Create or update connection record
    │     • Increment access_count
    │     • Update last_accessed timestamp
    │
    ├──► Record Performance Metric (metrics collection)
    │     • operation: "open_database"
    │     • duration_ms: 15
    │     • timestamp: now()
    │
    └──► Return Database Info
```

### Inserting a Document
```
Client Request
    │
    ▼
POST /api/databases/{db}/documents
    │
    ├──► Insert into User Database
    │
    ├──► Record Performance Metric
    │     • operation: "insert_document"
    │     • duration_ms: 8
    │
    └──► Return Document ID
```

### Querying System Statistics
```
Client Request
    │
    ▼
GET /api/system/stats
    │
    ├──► Query connections collection
    │     • Aggregate all connections
    │     • Calculate totals
    │
    └──► Return System Stats
         {
           "total_databases": 3,
           "total_collections": 7,
           "total_documents": 1250,
           "connections": [...]
         }
```

## System Database Collections

### 1. connections
Stores metadata about each database connection

| Field              | Type       | Description                      |
|--------------------|------------|----------------------------------|
| id                 | String     | Unique identifier                |
| path               | String     | Full path to database file       |
| created_at         | DateTime   | First registration time          |
| last_accessed      | DateTime   | Most recent access               |
| access_count       | u64        | Number of times accessed         |
| collections_count  | usize      | Number of collections in DB      |
| total_documents    | usize      | Total documents across all colls |

### 2. metrics
Records performance data for operations

| Field          | Type     | Description                    |
|----------------|----------|--------------------------------|
| id             | String   | Unique identifier              |
| database_path  | String   | Which database was operated on |
| operation      | String   | Operation type (e.g., "insert")|
| duration_ms    | u64      | How long it took (ms)         |
| timestamp      | DateTime | When it occurred               |

## API Endpoint Map

```
GET  /health                                    → Health Check
GET  /api/databases                            → List Active Databases
POST /api/databases/open                       → Open Database (+track)
POST /api/databases/create                     → Create Database (+track)
GET  /api/databases/{db}/collections           → List Collections
GET  /api/databases/{db}/stats                 → Database Statistics
POST /api/databases/{db}/documents             → Insert Document (+metric)
GET  /api/databases/{db}/documents             → Find Documents
GET  /api/databases/{db}/documents/{c}/{id}    → Find by ID
PUT  /api/databases/{db}/documents             → Update Document
DELETE /api/databases/{db}/documents           → Delete Document

GET  /api/system/stats                         → System Statistics
GET  /api/system/connections                   → Connection History
GET  /api/system/metrics/{db}                  → Database Metrics
DELETE /api/system/connections/{db}            → Remove Connection
```

## Thread Safety

```
AppState
├── databases: Arc<RwLock<HashMap<String, Arc<Database>>>>
│   └── Thread-safe storage of active database connections
│
└── system_db: Arc<SystemDatabase>
    └── SystemDatabase
        └── db: Database (keradb engine)
            └── Uses internal locking for thread safety
```

## OS-Agnostic Path Resolution

```rust
Windows:
  %USERPROFILE%\.keradb\.keradb_system.db
  Example: C:\Users\Alice\.keradb\.keradb_system.db

Linux:
  $HOME/.keradb/.keradb_system.db
  Example: /home/alice/.keradb/.keradb_system.db

macOS:
  $HOME/.keradb/.keradb_system.db
  Example: /Users/alice/.keradb/.keradb_system.db
```

The directory is automatically created on first run!
