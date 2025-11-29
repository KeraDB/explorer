import { ReactNode, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Database, Home, Settings, Activity, X, Trash2 } from 'lucide-react'
import { api } from '../api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface LayoutProps {
  children: ReactNode
  currentDatabase: string | null
  onOpenDatabase: (path: string) => void
}

interface DatabaseConnection {
  id: string
  path: string
  created_at: string
  last_accessed: string
  access_count: number
  collections_count: number
  total_documents: number
}

export default function Layout({ children, currentDatabase, onOpenDatabase }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [databases, setDatabases] = useState<DatabaseConnection[]>([])

  const isActive = (path: string) => location.pathname === path

  const fetchDatabases = async () => {
    try {
      const connections = await api.getConnectionHistory()
      setDatabases(connections)
    } catch (err) {
      console.error('Failed to fetch databases:', err)
    }
  }

  useEffect(() => {
    fetchDatabases()
    const interval = setInterval(fetchDatabases, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const handleOpenDatabase = async (dbPath: string) => {
    try {
      await api.openDatabase(dbPath)
      onOpenDatabase(dbPath)
      navigate('/explorer')
    } catch (err) {
      console.error('Failed to open database:', err)
    }
  }

  // Close database mutation
  const closeDatabaseMutation = useMutation({
    mutationFn: async (dbPath: string) => {
      await api.closeDatabase(dbPath)
    },
    onSuccess: () => {
      onOpenDatabase('')
      navigate('/')
      fetchDatabases()
      queryClient.invalidateQueries()
    },
  })

  // Delete database mutation
  const deleteDatabaseMutation = useMutation({
    mutationFn: async (dbPath: string) => {
      await api.deleteDatabase(dbPath)
    },
    onSuccess: () => {
      onOpenDatabase('')
      navigate('/')
      fetchDatabases()
      queryClient.invalidateQueries()
    },
  })

  const handleCloseDatabase = () => {
    if (!currentDatabase) return
    
    const confirmed = window.confirm(
      `Close database "${currentDatabase}"?\n\nThe database file will remain intact and can be reopened later.`
    )
    if (confirmed) {
      closeDatabaseMutation.mutate(currentDatabase)
    }
  }

  const handleDeleteDatabase = () => {
    if (!currentDatabase) return
    
    const confirmed = window.confirm(
      `⚠️ PERMANENT DELETION WARNING ⚠️\n\nThis will permanently delete the database file:\n"${currentDatabase}"\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?`
    )
    if (confirmed) {
      const doubleCheck = window.prompt(
        `Type "DELETE" to confirm permanent deletion of ${currentDatabase.split('/').pop()}`
      )
      if (doubleCheck === 'DELETE') {
        deleteDatabaseMutation.mutate(currentDatabase)
      }
    }
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 text-sm">
      {/* Sidebar */}
      <aside className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="px-3 py-2 border-b border-gray-700">
          <div className="flex items-center gap-1.5">
            <Database className="w-5 h-5 text-blue-500" />
            <div>
              <h1 className="text-base font-bold leading-tight">KeraDB</h1>
              <p className="text-[10px] text-gray-400">Database Explorer</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          <ul className="space-y-0.5">
            <li>
              <Link
                to="/"
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition ${
                  isActive('/') ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </Link>
            </li>
            <li>
              <Link
                to="/system"
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition ${
                  isActive('/system') ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>System Monitor</span>
              </Link>
            </li>
            
            {/* Database Section */}
            {databases.length > 0 && (
              <>
                <li className="pt-2 pb-1">
                  <p className="px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Databases ({databases.length})
                  </p>
                </li>
                {databases.map((db) => (
                  <li key={db.path}>
                    <button
                      onClick={() => handleOpenDatabase(db.path)}
                      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition text-left ${
                        currentDatabase === db.path ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
                      }`}
                    >
                      <Database className="w-3 h-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs">{db.path.split('/').pop() || db.path}</p>
                        <p className="text-[10px] text-gray-400">
                          {db.collections_count} colls • {db.total_documents} docs
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        </nav>

        {currentDatabase && (
          <div className="px-2 py-1.5 border-t border-gray-700">
            <div className="text-[10px] mb-1.5">
              <p className="text-gray-400">Current:</p>
              <p className="text-white truncate font-mono">{currentDatabase}</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleCloseDatabase}
                className="flex-1 flex items-center justify-center gap-0.5 px-1.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] transition"
                title="Close database connection"
              >
                <X className="w-2.5 h-2.5" />
                Close
              </button>
              <button
                onClick={handleDeleteDatabase}
                className="flex-1 flex items-center justify-center gap-0.5 px-1.5 py-1 bg-red-900 hover:bg-red-800 rounded text-[10px] transition"
                title="Permanently delete database"
              >
                <Trash2 className="w-2.5 h-2.5" />
                Delete
              </button>
            </div>
          </div>
        )}

        <div className="px-2 py-1.5 border-t border-gray-700">
          <button className="flex items-center gap-1.5 px-2 py-1 w-full rounded hover:bg-gray-700 transition text-xs">
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
