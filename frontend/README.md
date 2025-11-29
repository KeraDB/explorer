# keradb Labs Frontend

A modern, React-based web interface for keradb databases with real-time system monitoring.

## Features

### 🏠 **Home Dashboard**
- Quick database creation and opening
- Connection history with recent databases
- One-click access to frequently used databases
- Quick link to System Monitor

### 🔍 **Database Explorer**
- Browse collections and documents
- Full CRUD operations
- Real-time data updates
- JSON document editing
- **Drop collections** with one click (NEW!)
- **Close database** connections (NEW!)
- **Delete databases** permanently (NEW!)

### 📊 **System Monitor (NEW!)**
- **Real-time Monitoring**: Auto-refresh system statistics every 5 seconds
- **Connection Tracking**: View all registered databases with metadata
- **Performance Metrics**: See operation durations and identify slow queries
- **Visual Analytics**: Color-coded operation types and performance indicators
- **Interactive UI**: Click on databases to view detailed metrics

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Backend server running on `http://localhost:5800`

### Installation

```bash
# Navigate to frontend directory
cd keradb-labs/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start on `http://localhost:5810`

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## System Monitor Features

### Connection Dashboard
View all connected databases with:
- **Path**: Full database file path
- **Collections**: Number of collections in the database
- **Documents**: Total document count
- **Access Count**: How many times the database has been opened
- **Last Accessed**: When the database was last used

### Performance Metrics
Click on any database to see:
- **Average Operation Time**: Mean duration across all operations
- **Recent Operations**: Last 10 operations with timestamps
- **Operation Types**:
  - 🔵 `open_database` - Opening an existing database
  - 🟢 `create_database` - Creating a new database
  - 🟣 `insert_document` - Inserting documents
  - 🟡 `update_document` - Updating documents
  - 🔴 `delete_document` - Deleting documents
  - 🔵 `find_documents` - Querying documents

### Auto-Refresh
Toggle auto-refresh to:
- **ON**: Updates every 5 seconds automatically
- **OFF**: Manual refresh only

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout.tsx              # Main layout with navigation
│   │   └── ConnectionHistory.tsx   # Recent connections widget
│   ├── pages/
│   │   ├── Home.tsx               # Home dashboard
│   │   ├── Explorer.tsx           # Database explorer
│   │   └── SystemMonitor.tsx      # System monitoring (NEW!)
│   ├── App.tsx                    # Main app component
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Global styles
├── index.html
├── package.json
├── vite.config.ts                 # Vite configuration with proxy
└── tailwind.config.js             # Tailwind CSS config
```

## API Integration

The frontend communicates with the backend via these endpoints:

### System Endpoints
```typescript
GET  /api/system/stats              // System-wide statistics
GET  /api/system/connections        // Connection history
GET  /api/system/metrics/:db?limit  // Performance metrics
```

### Database Endpoints
```typescript
POST /api/databases/open            // Open database
POST /api/databases/create          // Create database
GET  /api/databases/:db/collections // List collections
GET  /api/databases/:db/stats       // Database statistics
```

### Document Endpoints
```typescript
POST   /api/databases/:db/documents  // Insert document
GET    /api/databases/:db/documents  // Find documents
GET    /api/databases/:db/documents/:collection/:id  // Find by ID
PUT    /api/databases/:db/documents  // Update document
DELETE /api/databases/:db/documents  // Delete document
```

## Configuration

### Vite Proxy (vite.config.ts)
```typescript
server: {
  port: 5810,
  proxy: {
    '/api': {
      target: 'http://localhost:5800',  // Backend server
      changeOrigin: true,
    },
  },
}
```

### Environment Variables
Create a `.env` file:
```bash
VITE_API_URL=http://localhost:5800
```

## Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Axios** - HTTP client
- **Lucide React** - Icons

## Development

### Running in Development
```bash
npm run dev
```

Features:
- Hot Module Replacement (HMR)
- TypeScript type checking
- Auto-reload on file changes

### Linting
```bash
npm run lint
```

### Type Checking
```bash
npm run type-check
```

## Components

### Layout Component
Main application layout with:
- Sidebar navigation
- Active route highlighting
- Current database indicator
- Responsive design

### ConnectionHistory Component
Displays recent database connections:
- Relative timestamps ("2m ago", "1h ago")
- Quick access to recent databases
- Connection statistics
- One-click database opening

### SystemMonitor Component
Full system monitoring dashboard:
- Statistics cards (databases, collections, documents)
- Interactive connection list
- Per-database metrics
- Real-time updates
- Auto-refresh toggle
- Operation legend

## Usage Examples

### Open a Database
```typescript
import axios from 'axios'

const openDatabase = async (path: string) => {
  try {
    const response = await axios.post('/api/databases/open', { path })
    console.log('Database opened:', response.data)
  } catch (error) {
    console.error('Failed to open database:', error)
  }
}
```

### Fetch System Stats
```typescript
const fetchSystemStats = async () => {
  const response = await axios.get('/api/system/stats')
  return response.data
}
```

### Monitor Performance
```typescript
const fetchMetrics = async (dbPath: string, limit = 50) => {
  const response = await axios.get(
    `/api/system/metrics/${encodeURIComponent(dbPath)}?limit=${limit}`
  )
  return response.data
}
```

## Styling

Uses Tailwind CSS utility classes:

### Color Scheme
- **Background**: Gray-900 to Gray-800
- **Primary**: Blue-500 to Blue-600
- **Success**: Green-500 to Green-600
- **Warning**: Yellow-400 to Yellow-500
- **Error**: Red-400 to Red-500
- **Text**: Gray-100 (primary), Gray-400 (secondary)

### Responsive Design
- Mobile-first approach
- Breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Grid layouts adapt to screen size

## Performance

### Optimization Features
- Auto-refresh can be toggled off
- Lazy loading of components
- Efficient re-rendering with React hooks
- Debounced API calls
- Cached connection data

### Best Practices
- Minimal API calls with auto-refresh off
- Local state management
- Error boundaries
- Loading states
- Graceful error handling

## Troubleshooting

### Port Already in Use
Change the port in `vite.config.ts`:
```typescript
server: {
  port: 5811,  // Change to available port
}
```

### API Connection Failed
1. Ensure backend is running on port 5800
2. Check browser console for CORS errors
3. Verify proxy configuration in `vite.config.ts`

### System Monitor Not Loading
1. Check backend has system database initialized
2. Verify `/api/system/stats` endpoint is accessible
3. Check browser network tab for failed requests

## Future Enhancements

- [ ] Real-time WebSocket updates
- [ ] Performance charts and graphs
- [ ] Query builder interface
- [ ] Export data to CSV/JSON
- [ ] Database comparison tools
- [ ] Backup/restore UI
- [ ] User preferences and themes
- [ ] Keyboard shortcuts
- [ ] Advanced filtering and search
- [ ] Multi-database operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

See the main project LICENSE file.

---

**Built with ❤️ using React, TypeScript, and Vite**
