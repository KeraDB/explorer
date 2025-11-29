import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Database, FolderOpen, Plus, Activity } from 'lucide-react'
import { api } from '../api'
import ConnectionHistory from '../components/ConnectionHistory'

interface HomeProps {
  onOpenDatabase: (path: string) => void
}

export default function Home({ onOpenDatabase }: HomeProps) {
  const [dbPath, setDbPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleBrowseFile = async () => {
    try {
      const selected = await api.openFileDialog()
      if (selected) {
        setDbPath(selected)
      }
    } catch (err: any) {
      setError('Failed to open file dialog')
    }
  }

  const handleBrowseNewFile = async () => {
    try {
      const selected = await api.saveFileDialog()
      if (selected) {
        setDbPath(selected)
      }
    } catch (err: any) {
      setError('Failed to open save dialog')
    }
  }

  const handleOpenDatabase = async () => {
    if (!dbPath.trim()) {
      setError('Please enter a database path')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await api.openDatabase(dbPath)
      onOpenDatabase(dbPath)
      navigate('/explorer')
    } catch (err: any) {
      setError(err || 'Failed to open database')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDatabase = async () => {
    if (!dbPath.trim()) {
      setError('Please enter a database path')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await api.createDatabase(dbPath)
      onOpenDatabase(dbPath)
      navigate('/explorer')
    } catch (err: any) {
      setError(err || 'Failed to create database')
    } finally {
      setLoading(false)
    }
  }

  const quickStart = [
    { name: 'Demo Database', path: 'demo.ndb' },
    { name: 'Test Database', path: 'test.ndb' },
    { name: 'My App', path: 'myapp.ndb' },
  ]

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="max-w-xl w-full mx-auto p-4">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <Database className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-3xl font-bold mb-1">KeraDB Labs</h1>
          <p className="text-sm text-gray-400">
            Visual Database Explorer for KeraDB Databases
          </p>
        </div>

        <div className="bg-gray-800 rounded p-4 shadow-xl">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4" />
            Open Database
          </h2>

          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium mb-1">
                Database Path
              </label>
              <div className="flex gap-1.5 mb-1.5">
                <input
                  type="text"
                  value={dbPath}
                  onChange={(e) => setDbPath(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleOpenDatabase()}
                  placeholder="path/to/database.ndb"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleBrowseFile}
                  className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition flex items-center gap-1"
                  title="Browse for existing database"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Browse
                </button>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleOpenDatabase}
                  disabled={loading}
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Opening...' : 'Open'}
                </button>
                <button
                  onClick={handleBrowseNewFile}
                  disabled={loading}
                  className="flex-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  title="Create new database with file dialog"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </button>
                <button
                  onClick={handleCreateDatabase}
                  disabled={loading}
                  className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
              {error && (
                <p className="text-red-400 text-xs mt-1">{error}</p>
              )}
            </div>

            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-400 mb-1.5">Quick Start:</p>
              <div className="grid grid-cols-3 gap-1">
                {quickStart.map((db) => (
                  <button
                    key={db.path}
                    onClick={() => setDbPath(db.path)}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {db.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Connection History */}
        <div className="bg-gray-800 rounded p-3 shadow-xl mt-3">
          <ConnectionHistory 
            onSelectDatabase={async (path) => {
              setDbPath(path)
              try {
                await api.openDatabase(path)
                onOpenDatabase(path)
                navigate('/explorer')
              } catch (err: any) {
                setError(err || 'Failed to open database')
              }
            }}
          />
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/system"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition border border-gray-700"
          >
            <Activity className="w-4 h-4" />
            <span>View System Monitor</span>
          </Link>
        </div>

        <div className="mt-3 text-center text-gray-500 text-xs">
          <p>KeraDB Labs v0.1.0 | Built with React + Rust | Ctrl+/- to zoom</p>
        </div>
      </div>
    </div>
  )
}
