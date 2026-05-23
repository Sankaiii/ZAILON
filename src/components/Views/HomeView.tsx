import { Play, Square, ChevronDown, Clock, Zap, FolderOpen, Search } from 'lucide-react'
import { useState } from 'react'
import { useStore, invoke, isTauri } from '../../store/useStore'
import { useT } from '../../i18n'
import { formatSeconds } from '../../utils'

function fmtTime(mins: number) {
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`
}

function timeAgo(ts?: number) {
  if (!ts) return 'Jamais'
  const d = Date.now() - ts
  if (d < 3600000) return `${Math.floor(d / 60000)}m`
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`
  return `${Math.floor(d / 86400000)}j`
}

export function HomeView() {
  const { games, selectedGame, selectedGameId, selectGame, setView,
    isPlaying, startPlaying, stopPlaying, sessionTime, language,
    detectGames, isDetecting } = useStore()
  const t = useT(language)
  const [profileOpen, setProfileOpen] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')

  const handlePlay = async () => {
    if (isPlaying) { stopPlaying(); return }
    if (!selectedGame?.execPath) { setLaunchError('Chemin du jeu non défini'); return }
    setLaunching(true); setLaunchError('')
    try {
      if (isTauri) await invoke('launch_game', { execPath: selectedGame.execPath })
      startPlaying()
    } catch (e) { setLaunchError(String(e)) }
    finally { setLaunching(false) }
  }

  const activeMods = selectedGame?.mods.filter(m => m.enabled).length ?? 0
  const bg = selectedGame?.backgroundArt

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-2">
          <Search size={28} className="text-gold/50" />
        </div>
        <h2 className="font-display font-bold text-xl text-white">{t('no_games')}</h2>
        <p className="text-sm text-white/40 max-w-xs">Détecte tes jeux installés ou ajoute-en un manuellement.</p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => detectGames()}
            disabled={isDetecting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-ink-400 font-display font-bold text-sm hover:bg-gold-bright transition-all disabled:opacity-50">
            {isDetecting ? '⏳ Détection...' : `🔍 ${t('detect')}`}
          </button>
          <button onClick={() => setView('games')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/70 text-sm hover:text-white transition-all">
            + {t('add_game')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        {bg ? (
          <img src={bg} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-ink-300 to-ink-400" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-ink-400/98 via-ink-400/75 to-ink-400/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-400/98 via-transparent to-transparent" />
      </div>

      <div className="relative flex flex-col h-full px-6 py-5">
        <div className="flex-1 flex flex-col justify-center max-w-sm">
          {/* Game badge */}
          <span className="text-xs font-mono text-gold/60 tracking-widest uppercase mb-1">
            {selectedGame?.execPath ? '◈ Local' : '◈ Non configuré'}
          </span>

          {/* Title */}
          <h1 className="font-display font-bold text-white leading-none mb-4" style={{ fontSize: 'clamp(22px, 3vw, 32px)' }}>
            {selectedGame?.name ?? 'No game'}
          </h1>

          {/* Profile selector */}
          <div className="relative mb-5">
            <button onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.07] border border-white/[0.1] hover:border-gold/30 transition-all text-sm">
              <span className="text-white/80 font-body">Default</span>
              <ChevronDown size={12} className="text-white/40" />
              <span className="text-xs text-white/30 ml-1">{activeMods} {t('active')}</span>
            </button>
          </div>

          {/* Error */}
          {launchError && <p className="text-xs text-red-400 mb-2">{launchError}</p>}

          {/* Play button */}
          <div className="flex items-center gap-3">
            <button onClick={handlePlay} disabled={launching}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-display font-bold tracking-wider transition-all duration-200 text-base disabled:opacity-70 ${
                isPlaying
                  ? 'bg-red-500/80 text-white hover:bg-red-600 border border-red-400/30'
                  : 'bg-gold text-ink-400 hover:bg-gold-bright shadow-[0_0_20px_rgba(232,184,75,0.35)]'
              }`}>
              {isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              {launching ? '...' : isPlaying ? `${t('stop')} ${formatSeconds(sessionTime)}` : t('play')}
            </button>

            {!selectedGame?.execPath && (
              <button onClick={async () => {
                if (!isTauri) return
                const p = await invoke<string|null>('pick_file', { filter: 'exe' }).catch(() => null)
                if (p && selectedGame) useStore.getState().setGamePath(selectedGame.id, p)
              }} className="p-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/40 hover:text-white/70 transition-all">
                <FolderOpen size={14} />
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-white/30" />
              <span className="text-xs text-white/40 font-mono">{selectedGame ? fmtTime(selectedGame.playtime) : '0m'}</span>
            </div>
            {selectedGame?.lastPlayed && (
              <span className="text-xs text-white/30">Last: {timeAgo(selectedGame.lastPlayed)}</span>
            )}
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-gold/50" />
              <span className="text-xs text-gold/60">{activeMods} mods</span>
            </div>
          </div>
        </div>

        {/* Recent games strip */}
        <div className="flex items-center gap-2 pb-1">
          <span className="text-xs font-mono text-white/25 uppercase tracking-widest mr-1">{t('recent')}</span>
          {[...games].sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0)).slice(0, 5).map(game => (
            <button key={game.id} onClick={() => selectGame(game.id)}
              className={`relative w-18 h-10 rounded-lg overflow-hidden border transition-all flex-shrink-0 ${
                game.id === selectedGameId ? 'border-gold/60 shadow-[0_0_8px_rgba(232,184,75,0.3)]' : 'border-white/[0.07] opacity-60 hover:opacity-90'
              }`} style={{ width: 72 }}>
              {game.backgroundArt
                ? <img src={game.backgroundArt} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-ink-200 flex items-center justify-center"><span className="text-lg">{game.name[0]}</span></div>
              }
              <div className="absolute inset-0 bg-ink-400/50 flex items-end p-1">
                <span className="text-[9px] font-display font-bold text-white leading-none truncate">{game.name.slice(0, 6)}</span>
              </div>
            </button>
          ))}
          <button onClick={() => setView('games')}
            className="flex items-center justify-center flex-shrink-0 rounded-lg border border-dashed border-white/[0.08] hover:border-white/20 opacity-50 hover:opacity-80 transition-all text-xs text-white/40"
            style={{ width: 72, height: 40 }}>
            All →
          </button>
        </div>
      </div>
    </div>
  )
}
