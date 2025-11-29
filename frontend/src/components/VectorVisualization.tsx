import { useRef, useEffect, useState, useCallback } from 'react'
import { VectorDocument, VectorSearchResult } from '../api'
import { ZoomIn, ZoomOut, RotateCcw, MousePointer } from 'lucide-react'

interface Point2D {
  x: number
  y: number
  id: number
  metadata: Record<string, any> | null
  isSearchResult?: boolean
  score?: number
  originalVector: number[]
}

interface VectorVisualizationProps {
  vectors: VectorDocument[]
  searchResults?: VectorSearchResult[]
  queryVector?: number[]
  onVectorClick?: (vector: VectorDocument) => void
  dimensions: number
}

// Simple PCA implementation for 2D projection
function projectTo2D(vectors: number[][], queryVector?: number[]): { projected: [number, number][], queryProjected?: [number, number] } {
  if (vectors.length === 0) return { projected: [] }
  
  const allVectors = queryVector ? [...vectors, queryVector] : vectors
  const dim = allVectors[0].length
  const n = allVectors.length
  
  // Calculate mean
  const mean = new Array(dim).fill(0)
  for (const v of allVectors) {
    for (let i = 0; i < dim; i++) {
      mean[i] += v[i] / n
    }
  }
  
  // Center the data
  const centered = allVectors.map(v => v.map((x, i) => x - mean[i]))
  
  // Simple power iteration for top 2 principal components
  // This is a simplified approach - for production, use a proper library
  const pc1 = powerIteration(centered, dim)
  const pc2 = powerIterationOrthogonal(centered, dim, pc1)
  
  // Project all vectors
  const projected = centered.map(v => {
    const x = dotProduct(v, pc1)
    const y = dotProduct(v, pc2)
    return [x, y] as [number, number]
  })
  
  if (queryVector) {
    const queryProjected = projected.pop()
    return { projected, queryProjected }
  }
  
  return { projected }
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, x, i) => sum + x * b[i], 0)
}

function powerIteration(data: number[][], dim: number): number[] {
  // Initialize random vector
  let v = new Array(dim).fill(0).map(() => Math.random() - 0.5)
  
  // Normalize
  let norm = Math.sqrt(dotProduct(v, v))
  v = v.map(x => x / norm)
  
  // Power iteration
  for (let iter = 0; iter < 50; iter++) {
    // Compute A^T * A * v where A is our centered data matrix
    const result = new Array(dim).fill(0)
    for (const row of data) {
      const proj = dotProduct(row, v)
      for (let i = 0; i < dim; i++) {
        result[i] += row[i] * proj
      }
    }
    
    norm = Math.sqrt(dotProduct(result, result))
    if (norm > 1e-10) {
      v = result.map(x => x / norm)
    }
  }
  
  return v
}

function powerIterationOrthogonal(data: number[][], dim: number, pc1: number[]): number[] {
  // Initialize random vector
  let v = new Array(dim).fill(0).map(() => Math.random() - 0.5)
  
  // Remove pc1 component
  const proj1 = dotProduct(v, pc1)
  v = v.map((x, i) => x - proj1 * pc1[i])
  
  // Normalize
  let norm = Math.sqrt(dotProduct(v, v))
  v = v.map(x => x / norm)
  
  // Power iteration
  for (let iter = 0; iter < 50; iter++) {
    const result = new Array(dim).fill(0)
    for (const row of data) {
      const proj = dotProduct(row, v)
      for (let i = 0; i < dim; i++) {
        result[i] += row[i] * proj
      }
    }
    
    // Remove pc1 component
    const proj1 = dotProduct(result, pc1)
    for (let i = 0; i < dim; i++) {
      result[i] -= proj1 * pc1[i]
    }
    
    norm = Math.sqrt(dotProduct(result, result))
    if (norm > 1e-10) {
      v = result.map(x => x / norm)
    }
  }
  
  return v
}

export default function VectorVisualization({
  vectors,
  searchResults = [],
  queryVector,
  onVectorClick,
  dimensions
}: VectorVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 300 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredPoint, setHoveredPoint] = useState<Point2D | null>(null)
  const [projectedPoints, setProjectedPoints] = useState<Point2D[]>([])
  const [queryPoint, setQueryPoint] = useState<[number, number] | null>(null)

  // Handle resize to match container size
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      setCanvasSize({
        width: Math.floor(rect.width * dpr),
        height: Math.floor(rect.height * dpr)
      })
    }

    updateSize()
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])
  
  // Project vectors to 2D when they change
  useEffect(() => {
    if (vectors.length === 0) {
      setProjectedPoints([])
      setQueryPoint(null)
      return
    }
    
    const rawVectors = vectors.map(v => v.vector)
    const searchResultIds = new Set(searchResults.map(r => r.id))
    const scoreMap = new Map(searchResults.map(r => [r.id, r.score]))
    
    const { projected, queryProjected } = projectTo2D(rawVectors, queryVector)
    
    const points: Point2D[] = projected.map((p, i) => ({
      x: p[0],
      y: p[1],
      id: vectors[i].id,
      metadata: vectors[i].metadata,
      isSearchResult: searchResultIds.has(vectors[i].id),
      score: scoreMap.get(vectors[i].id),
      originalVector: vectors[i].vector
    }))
    
    setProjectedPoints(points)
    setQueryPoint(queryProjected || null)
  }, [vectors, searchResults, queryVector])
  
  // Draw the visualization
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match container with device pixel ratio for sharpness
    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    ctx.scale(dpr, dpr)
    
    const width = rect.width
    const height = rect.height
    
    // Clear canvas
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(0, 0, width, height)
    
    if (projectedPoints.length === 0) {
      ctx.fillStyle = '#6b7280'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No vectors to display', width / 2, height / 2)
      return
    }
    
    // Find bounds
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    
    for (const p of projectedPoints) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    
    if (queryPoint) {
      minX = Math.min(minX, queryPoint[0])
      maxX = Math.max(maxX, queryPoint[0])
      minY = Math.min(minY, queryPoint[1])
      maxY = Math.max(maxY, queryPoint[1])
    }
    
    // Add padding
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const padding = 40
    
    // Transform function
    const transform = (x: number, y: number): [number, number] => {
      const tx = ((x - minX) / rangeX) * (width - 2 * padding) + padding
      const ty = height - (((y - minY) / rangeY) * (height - 2 * padding) + padding)
      
      // Apply zoom and pan
      const cx = width / 2
      const cy = height / 2
      const zoomedX = (tx - cx) * zoom + cx + pan.x
      const zoomedY = (ty - cy) * zoom + cy + pan.y
      
      return [zoomedX, zoomedY]
    }
    
    // Draw grid
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i <= 10; i++) {
      const x = padding + (i / 10) * (width - 2 * padding)
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      const y = padding + (i / 10) * (height - 2 * padding)
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    ctx.stroke()
    
    // Draw regular points
    for (const point of projectedPoints) {
      if (point.isSearchResult) continue
      
      const [x, y] = transform(point.x, point.y)
      
      ctx.beginPath()
      ctx.arc(x, y, 4 * zoom, 0, Math.PI * 2)
      ctx.fillStyle = '#60a5fa'
      ctx.fill()
    }
    
    // Draw search result points (highlighted)
    for (const point of projectedPoints) {
      if (!point.isSearchResult) continue
      
      const [x, y] = transform(point.x, point.y)
      
      // Outer glow
      ctx.beginPath()
      ctx.arc(x, y, 8 * zoom, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'
      ctx.fill()
      
      // Inner circle
      ctx.beginPath()
      ctx.arc(x, y, 5 * zoom, 0, Math.PI * 2)
      ctx.fillStyle = '#22c55e'
      ctx.fill()
      
      // Score label
      if (point.score !== undefined) {
        ctx.fillStyle = '#ffffff'
        ctx.font = `${10 * zoom}px sans-serif`
        ctx.textAlign = 'left'
        ctx.fillText(`${point.score.toFixed(3)}`, x + 8 * zoom, y + 3 * zoom)
      }
    }
    
    // Draw query point
    if (queryPoint) {
      const [x, y] = transform(queryPoint[0], queryPoint[1])
      
      // Diamond shape for query
      ctx.beginPath()
      const size = 8 * zoom
      ctx.moveTo(x, y - size)
      ctx.lineTo(x + size, y)
      ctx.lineTo(x, y + size)
      ctx.lineTo(x - size, y)
      ctx.closePath()
      ctx.fillStyle = '#f59e0b'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Label
      ctx.fillStyle = '#ffffff'
      ctx.font = `${11 * zoom}px sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText('Query', x + 12 * zoom, y + 4 * zoom)
    }
    
    // Draw hovered point info
    if (hoveredPoint) {
      const [x, y] = transform(hoveredPoint.x, hoveredPoint.y)
      
      // Highlight circle
      ctx.beginPath()
      ctx.arc(x, y, 10 * zoom, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Info box
      const infoX = Math.min(x + 15, width - 180)
      const infoY = Math.max(y - 60, 10)
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fillRect(infoX, infoY, 170, 55)
      
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`ID: ${hoveredPoint.id}`, infoX + 8, infoY + 18)
      ctx.fillText(`Dims: ${hoveredPoint.originalVector.length}`, infoX + 8, infoY + 34)
      if (hoveredPoint.metadata) {
        const metaStr = JSON.stringify(hoveredPoint.metadata).slice(0, 20) + '...'
        ctx.fillText(metaStr, infoX + 8, infoY + 50)
      }
    }
    
    // Draw legend
    const legendY = height - 30
    ctx.fillStyle = '#9ca3af'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    
    // Regular point
    ctx.beginPath()
    ctx.arc(20, legendY, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#60a5fa'
    ctx.fill()
    ctx.fillStyle = '#9ca3af'
    ctx.fillText('Vector', 30, legendY + 4)
    
    // Search result
    ctx.beginPath()
    ctx.arc(100, legendY, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#22c55e'
    ctx.fill()
    ctx.fillStyle = '#9ca3af'
    ctx.fillText('Match', 110, legendY + 4)
    
    // Query
    ctx.beginPath()
    ctx.moveTo(180, legendY - 5)
    ctx.lineTo(185, legendY)
    ctx.lineTo(180, legendY + 5)
    ctx.lineTo(175, legendY)
    ctx.closePath()
    ctx.fillStyle = '#f59e0b'
    ctx.fill()
    ctx.fillStyle = '#9ca3af'
    ctx.fillText('Query', 195, legendY + 4)
    
  }, [projectedPoints, queryPoint, zoom, pan, hoveredPoint, canvasSize])
  
  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }, [pan])
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    if (isDragging) {
      setPan({ 
        x: e.clientX - dragStart.x, 
        y: e.clientY - dragStart.y 
      })
      return
    }
    
    // Check for hover - use CSS dimensions (rect), not canvas physical pixels
    const width = rect.width
    const height = rect.height
    
    if (projectedPoints.length === 0) return
    
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    
    for (const p of projectedPoints) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const padding = 40
    
    let closest: Point2D | null = null
    let closestDist = 20 * zoom // Max hover distance
    
    for (const point of projectedPoints) {
      const tx = ((point.x - minX) / rangeX) * (width - 2 * padding) + padding
      const ty = height - (((point.y - minY) / rangeY) * (height - 2 * padding) + padding)
      
      const cx = width / 2
      const cy = height / 2
      const zoomedX = (tx - cx) * zoom + cx + pan.x
      const zoomedY = (ty - cy) * zoom + cy + pan.y
      
      const dist = Math.sqrt((mouseX - zoomedX) ** 2 + (mouseY - zoomedY) ** 2)
      if (dist < closestDist) {
        closestDist = dist
        closest = point
      }
    }
    
    setHoveredPoint(closest)
  }, [isDragging, dragStart, projectedPoints, zoom, pan])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])
  
  const handleClick = useCallback(() => {
    if (hoveredPoint && onVectorClick) {
      const doc = vectors.find(v => v.id === hoveredPoint.id)
      if (doc) onVectorClick(doc)
    }
  }, [hoveredPoint, vectors, onVectorClick])
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1 // Scroll down = zoom out, scroll up = zoom in
    setZoom(z => Math.max(0.2, Math.min(5, z * delta)))
  }, [])
  
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 5))
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.2))
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  
  return (
    <div ref={containerRef} className="relative h-full bg-gray-800 rounded">
      <div className="absolute top-1 right-1 z-10 flex gap-0.5">
        <button
          onClick={handleZoomIn}
          className="p-1 bg-gray-700 hover:bg-gray-600 rounded transition"
          title="Zoom In"
        >
          <ZoomIn className="w-3 h-3" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1 bg-gray-700 hover:bg-gray-600 rounded transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-3 h-3" />
        </button>
        <button
          onClick={handleReset}
          className="p-1 bg-gray-700 hover:bg-gray-600 rounded transition"
          title="Reset View"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>
      
      <div className="absolute top-1 left-1 z-10 bg-gray-800/80 px-1.5 py-0.5 rounded text-[10px] text-gray-400">
        <MousePointer className="w-2.5 h-2.5 inline mr-0.5" />
        PCA 2D • {vectors.length} vecs • {dimensions}D
      </div>
      
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full rounded cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />
    </div>
  )
}
