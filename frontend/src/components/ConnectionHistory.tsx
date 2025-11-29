import { useEffect, useState } from 'react'
import { Database, Clock, Folder } from 'lucide-react'
import { api } from '../api'

interface DatabaseConnection {
  id: string
  path: string
  created_at: string
  last_accessed: string
  access_count: number
  collections_count: number
  total_documents: number
}

interface ConnectionHistoryProps {
  onSelectDatabase?: (path: string) => void
}

export default function ConnectionHistory({ onSelectDatabase }: ConnectionHistoryProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConnections = async () => {
    try {
      const connections = await api.getConnectionHistory()
      setConnections(connections)
    } catch (err) {
      console.error('Failed to fetch connections:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="text-center py-4 text-gray-400 text-xs">
        <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-1" />
        Loading...
      </div>
    )
  }

  if (connections.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400 text-xs">
        <Database className="w-8 h-8 mx-auto mb-1 opacity-50" />
        <p>No recent connections</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Recent ({connections.length})
      </h3>
      
      {connections.map((conn) => (
        <button
          key={conn.path}
          onClick={() => onSelectDatabase?.(conn.path)}
          className="w-full px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition text-left"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-1 flex-1 min-w-0">
              <Folder className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs truncate">{conn.path}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                  <span>{conn.collections_count} colls</span>
                  <span>{conn.total_documents} docs</span>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
              {formatDate(conn.last_accessed)}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
