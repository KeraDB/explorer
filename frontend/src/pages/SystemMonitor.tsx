import { useEffect, useState } from 'react'
import { Activity, Database, Layers, FileText, TrendingUp, Zap, AlertCircle } from 'lucide-react'
import { api } from '../api'

interface SystemStats {
  total_databases: number
  total_collections: number
  total_documents: number
  connections: DatabaseConnection[]
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

interface PerformanceMetric {
  id: string
  database_path: string
  operation: string
  duration_ms: number
  timestamp: string
}

export default function SystemMonitor() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([])
  const [selectedDb, setSelectedDb] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchSystemStats = async () => {
    try {
      const stats = await api.getSystemStats()
      setStats(stats)
      setError(null)
    } catch (err: any) {
      setError(err || 'Failed to fetch system stats')
    } finally {
      setLoading(false)
    }
  }

  const fetchMetrics = async (dbPath: string) => {
    try {
      const metrics = await api.getDatabaseMetrics(dbPath, 50)
      setMetrics(metrics)
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err)
    }
  }

  useEffect(() => {
    fetchSystemStats()

    if (autoRefresh) {
      const interval = setInterval(fetchSystemStats, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  useEffect(() => {
    if (selectedDb) {
      fetchMetrics(selectedDb)
      
      if (autoRefresh) {
        const interval = setInterval(() => fetchMetrics(selectedDb), 5000)
        return () => clearInterval(interval)
      }
    }
  }, [selectedDb, autoRefresh])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const formatDuration = (ms: number) => {
    if (ms < 1) return '<1ms'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const getAverageDuration = (dbPath: string) => {
    const dbMetrics = metrics.filter(m => m.database_path === dbPath)
    if (dbMetrics.length === 0) return 0
    const sum = dbMetrics.reduce((acc, m) => acc + m.duration_ms, 0)
    return Math.round(sum / dbMetrics.length)
  }

  const getOperationColor = (operation: string) => {
    const colors: Record<string, string> = {
      open_database: 'bg-blue-500',
      create_database: 'bg-green-500',
      insert_document: 'bg-purple-500',
      update_document: 'bg-yellow-500',
      delete_document: 'bg-red-500',
      find_documents: 'bg-cyan-500',
    }
    return colors[operation] || 'bg-gray-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-gray-400 text-xs">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-400 text-xs">{error}</p>
          <button
            onClick={fetchSystemStats}
            className="mt-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 p-3">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              System Monitor
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">
              Real-time monitoring for NoSQLite
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded w-3 h-3"
              />
              Auto
            </label>
            <button
              onClick={fetchSystemStats}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition flex items-center gap-1"
            >
              <Activity className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-[10px]">Databases</p>
                <p className="text-xl font-bold">{stats?.total_databases || 0}</p>
              </div>
              <Database className="w-6 h-6 text-blue-500 opacity-50" />
            </div>
          </div>

          <div className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-[10px]">Collections</p>
                <p className="text-xl font-bold">{stats?.total_collections || 0}</p>
              </div>
              <Layers className="w-6 h-6 text-green-500 opacity-50" />
            </div>
          </div>

          <div className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-[10px]">Documents</p>
                <p className="text-xl font-bold">{stats?.total_documents || 0}</p>
              </div>
              <FileText className="w-6 h-6 text-purple-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Database Connections */}
        <div className="bg-gray-800 rounded p-3 mb-4 border border-gray-700">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <Database className="w-3.5 h-3.5" />
            Connections
          </h2>

          {stats?.connections.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-4">No databases connected</p>
          ) : (
            <div className="space-y-1.5">
              {stats?.connections.map((conn) => (
                <div
                  key={conn.path}
                  onClick={() => setSelectedDb(conn.path === selectedDb ? null : conn.path)}
                  className={`p-2 rounded border transition cursor-pointer ${
                    selectedDb === conn.path
                      ? 'bg-blue-900/30 border-blue-500'
                      : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <Database className="w-3 h-3 text-blue-400" />
                        <span className="font-mono text-xs truncate">{conn.path}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-[10px]">
                        <div>
                          <p className="text-gray-400">Colls</p>
                          <p className="font-semibold">{conn.collections_count}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Docs</p>
                          <p className="font-semibold">{conn.total_documents}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Accesses</p>
                          <p className="font-semibold">{conn.access_count}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Last</p>
                          <p className="font-semibold truncate">{formatDate(conn.last_accessed)}</p>
                        </div>
                      </div>
                    </div>
                    {selectedDb === conn.path && (
                      <Zap className="w-3.5 h-3.5 text-blue-500" />
                    )}
                  </div>

                  {selectedDb === conn.path && (
                    <div className="mt-2 pt-2 border-t border-gray-600">
                      <div className="flex items-center gap-1 mb-2">
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        <span className="text-[10px] font-semibold">Metrics</span>
                      </div>
                      
                      {metrics.length === 0 ? (
                        <p className="text-gray-400 text-[10px]">No metrics</p>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-400">Avg Time:</span>
                            <span className="font-semibold text-green-400">
                              {formatDuration(getAverageDuration(conn.path))}
                            </span>
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-0.5">
                            {metrics.slice(0, 10).map((metric) => (
                              <div
                                key={metric.id}
                                className="flex items-center justify-between text-[10px] py-0.5 px-1 bg-gray-800 rounded"
                              >
                                <div className="flex items-center gap-1">
                                  <div className={`w-1.5 h-1.5 rounded-full ${getOperationColor(metric.operation)}`} />
                                  <span className="text-gray-400">{metric.operation}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={metric.duration_ms > 100 ? 'text-yellow-400' : 'text-green-400'}>
                                    {formatDuration(metric.duration_ms)}
                                  </span>
                                  <span className="text-gray-500">
                                    {new Date(metric.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-gray-800 rounded p-2 border border-gray-700">
          <h3 className="text-[10px] font-semibold mb-1">Operations</h3>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>open</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>create</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span>insert</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>update</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>delete</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-cyan-500" />
              <span>find</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
