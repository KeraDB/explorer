# keradb Labs

A modern, full-stack database management and monitoring application for keradb databases with real-time system monitoring.

## 🚀 Quick Start

### Prerequisites
- Rust 1.70+ (https://rustup.rs)
- Node.js 16+ (https://nodejs.org)

### Start Servers

**Backend (Terminal 1):**
```bash
cd backend && ./start.sh
```
Runs on `http://localhost:5800`

**Frontend (Terminal 2):**
```bash
cd frontend && ./start.sh
```
Runs on `http://localhost:5810`

Open browser to `http://localhost:5810`

## ✨ Features

### 🌐 Web Interface
- Modern React-based UI
- Dark theme design
- Responsive layout
- Intuitive navigation

### 📊 Database Explorer
- Create and open databases
- Browse collections
- Full CRUD operations
- JSON document editing
- Real-time updates

### 📈 System Monitor (NEW!)
- **Real-time monitoring** - Auto-refresh every 5 seconds
- **Connection tracking** - All registered databases
- **Performance metrics** - Operation duration tracking
- **Visual analytics** - Color-coded operations
- **Interactive UI** - Click databases for details

### 🔍 System Database
- **Automatic tracking** - All database connections
- **Performance logging** - Operation durations
- **Usage statistics** - Access counts and patterns
- **OS-agnostic storage** - Works on Windows/Linux/Mac
- **Persistent metadata** - Survives server restarts

## 🛠️ Tech Stack

### Backend
- **Rust** - Systems programming language
- **Actix-Web** - High-performance web framework
- **keradb** - Document database engine
- **Serde** - Serialization framework
- **Chrono** - Date/time handling

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Utility-first CSS
- **Axios** - HTTP client
- **Lucide React** - Icon library
- **React Router** - Navigation

## 📁 Project Structure

```
keradb-labs/
├── backend/                      # Rust backend
│   ├── src/
│   │   ├── main.rs              # API server
│   │   └── system_db.rs         # System database ✨
│   ├── start.sh                 # Start script
│   ├── SYSTEM_DB.md             # System DB docs
│   ├── ARCHITECTURE.md          # Architecture guide
│   └── README.md
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Explorer.tsx
│   │   │   └── SystemMonitor.tsx     ✨
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   └── ConnectionHistory.tsx ✨
│   │   └── App.tsx
│   ├── start.sh                 # Start script
│   └── README.md
│
├── FRONTEND_IMPLEMENTATION.md    # Implementation guide
└── README.md                     # This file
```

## 📊 System Monitor Features

### Dashboard View
- **Total Databases** - Count of all registered databases
- **Total Collections** - Sum across all databases  
- **Total Documents** - Complete document count
- **Auto-refresh** - Updates every 5 seconds (toggleable)

### Connection List
Each database shows:
- Path and filename
- Number of collections
- Number of documents
- Access count
- Last accessed time

### Performance Metrics
Click any database to see:
- Average operation time
- Recent operations (last 10)
- Operation durations
- Color-coded operation types:
  - 🔵 open_database
  - 🟢 create_database
  - 🟣 insert_document
  - 🟡 update_document
  - 🔴 delete_document

## 🔗 API Endpoints

### System Monitoring
```
GET  /api/system/stats              # System statistics
GET  /api/system/connections        # Connection history
GET  /api/system/metrics/{db}       # Performance metrics
DELETE /api/system/connections/{db} # Remove connection
```

### Database Operations
```
POST /api/databases/open            # Open database
POST /api/databases/create          # Create database
GET  /api/databases/{db}/stats      # Database stats
```

### Document Operations
```
POST   /api/databases/{db}/documents    # Insert
GET    /api/databases/{db}/documents    # Find all
PUT    /api/databases/{db}/documents    # Update
DELETE /api/databases/{db}/documents    # Delete
```

## 📚 Documentation

- **[Backend README](./backend/README.md)** - Backend API & System DB
- **[Frontend README](./frontend/README.md)** - Frontend usage guide
- **[System DB Guide](./backend/SYSTEM_DB.md)** - System database details
- **[Architecture](./backend/ARCHITECTURE.md)** - System architecture
- **[Implementation](./FRONTEND_IMPLEMENTATION.md)** - Implementation guide

## 🧪 Testing

### Backend Tests
```bash
cd backend
./test_system_db.sh
```

### View System Stats
```bash
curl http://localhost:5800/api/system/stats | jq
```

## 🎯 Use Cases

1. **Database Development** - Quick prototyping and testing
2. **Performance Monitoring** - Track operation durations
3. **Usage Analytics** - See which databases are used most
4. **Database Management** - Centralized control of multiple DBs

## 🔒 Security Note

- System database stored in user's home directory: `~/.keradb/`
- No authentication (add for production use)
- CORS enabled for development

## 🚨 Troubleshooting

See individual README files in `backend/` and `frontend/` directories.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Built with ❤️ using Rust, React, and keradb**
