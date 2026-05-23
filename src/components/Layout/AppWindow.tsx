import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { useStore } from '../../store/useStore'
import { HomeView } from '../Views/HomeView'
import { GamesView } from '../Views/GamesView'
import { ExploreView } from '../Views/ExploreView'
import { NewsView } from '../Views/NewsView'
import { SettingsView } from '../Views/SettingsView'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export function AppWindow() {
  const { currentView } = useStore()

  const View = { home: HomeView, games: GamesView, explore: ExploreView, news: NewsView, settings: SettingsView }[currentView]

  const content = (
    <>
      <div className="pointer-events-none absolute inset-0 z-50 opacity-[0.02]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: 'repeat', backgroundSize: '128px' }} />
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden animate-fade-in relative"><View /></main>
      </div>
    </>
  )

  if (isTauri) {
    return (
      <div className="flex flex-col overflow-hidden w-screen h-screen relative"
        style={{ background: 'linear-gradient(135deg, #080710 0%, #0d0c17 100%)' }}>
        {content}
      </div>
    )
  }

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl shadow-2xl"
      style={{ width: 960, height: 580, background: 'linear-gradient(135deg, #080710 0%, #0d0c17 100%)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.06),0 32px 80px rgba(0,0,0,0.8),0 0 40px rgba(232,184,75,0.04)' }}>
      {content}
    </div>
  )
}
