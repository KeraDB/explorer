import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Home from './pages/Home'
import Explorer from './pages/Explorer'
import SystemMonitor from './pages/SystemMonitor'
import './App.css'

function App() {
  const [currentDatabase, setCurrentDatabase] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem('app-zoom-level')
    return saved ? parseFloat(saved) : 1
  })

  // Apply zoom level to CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--zoom-level', zoomLevel.toString())
    localStorage.setItem('app-zoom-level', zoomLevel.toString())
  }, [zoomLevel])

  // Handle keyboard zoom (Ctrl+/-, Ctrl+0 to reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          setZoomLevel(prev => Math.min(prev + 0.1, 2))
        } else if (e.key === '-') {
          e.preventDefault()
          setZoomLevel(prev => Math.max(prev - 0.1, 0.5))
        } else if (e.key === '0') {
          e.preventDefault()
          setZoomLevel(1)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Layout currentDatabase={currentDatabase} onOpenDatabase={setCurrentDatabase}>
      <Routes>
        <Route path="/" element={<Home onOpenDatabase={setCurrentDatabase} />} />
        <Route path="/explorer" element={<Explorer database={currentDatabase} />} />
        <Route path="/system" element={<SystemMonitor />} />
      </Routes>
    </Layout>
  )
}

export default App
