import { useEffect } from 'react'
import { AppWindow } from './components/Layout/AppWindow'
import { useStore } from './store/useStore'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export default function App() {
  const { tick, detectGames, games } = useStore()

  // Responsive scaling
  useEffect(() => {
    const updateScale = () => {
      const baseW = 960
      const rawScale = window.innerWidth / baseW
      const scale = rawScale > 1.05 ? Math.min(rawScale * 0.97, 2.5) : 1
      document.documentElement.style.setProperty('--ui-scale', scale.toFixed(3))
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  // Playtime ticker
  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tick])

  // Auto-detect games on first launch
  useEffect(() => {
    if (games.length === 0 && isTauri) detectGames()
  }, [])

  if (isTauri) return <AppWindow />

  return (
    <div className="min-h-screen bg-[#030308] flex items-center justify-center p-8"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 50%, rgba(232,184,75,0.03) 0%, transparent 70%)' }}>
      <AppWindow />
    </div>
  )
}
