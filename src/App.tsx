import { useEffect } from 'react'
import { AppWindow } from './components/Layout/AppWindow'
import { useStore } from './store/useStore'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export default function App() {
  const { tick, detectGames, games } = useStore()

  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tick])

  // Auto-detect games on first launch if no games
  useEffect(() => {
    if (games.length === 0 && isTauri) {
      detectGames()
    }
  }, [])

  if (isTauri) {
    return <AppWindow />
  }

  return (
    <div className="min-h-screen bg-[#030308] flex items-center justify-center p-8"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 50%, rgba(232,184,75,0.03) 0%, transparent 70%)' }}>
      <div className="absolute w-[1000px] h-[600px] rounded-2xl pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(232,184,75,0.05) 0%, transparent 70%)' }} />
      <AppWindow />
    </div>
  )
}
