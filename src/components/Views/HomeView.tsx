import { Play, Square, ChevronDown, Clock, Zap, FolderOpen, Search } from 'lucide-react'
import { useState } from 'react'
import { useStore, invoke, isTauri } from '../../store/useStore'
import { useT } from '../../i18n'
import { formatSeconds } from '../../utils'

function fmtTime(mins: number) {
  if (!mins) return '0m'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`
}

function timeAgo(ts?: number) {
  if (!ts) return null
  const d = Date.now() - ts
  if (d < 3600000) return `${Math.floor(d / 60000)}min`
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`
  return `${Math.floor(d / 86400000)}j`
}

export function HomeView() {
  const { games, selectedGame, selectedGameId, selectGame, setView,
    isPlaying, startPlaying, stopPlaying, sessionTime, language,
    detectGames, isDetecting } = useStore()
  const t = useT(language)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')

  const handlePlay = async () => {
    if (isPlaying) { stopPlaying(); return }
    if (!selectedGame?.execPath) { setLaunchError('Définis le .exe du jeu dans Jeux → Settings'); return }
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
        <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center">
          <Search size={28} className="text-gold/50" />
        </div>
        <h2 className="font-display font-bold text-xl text-white">{t('no_games')}</h2>
        <p className="text-sm text-white/40 max-w-xs">Détecte tes jeux ou ajoute-en un manuellement.</p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => detectGames()} disabled={isDetecting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-ink-400 font-display font-bold text-sm hover:bg-gold-bright transition-all disabled:opacity-50">
            {isDetecting ? '⏳ Détection...' : `🔍 ${t('detect')}`}
          </button>
          <button onClick={() => setView('games')}
            className="px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/70 text-sm hover:text-white transition-all">
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
        {bg
          ? <img src={bg} alt="" className="w-full h-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
          : <div className="w-full h-full bg-gradient-to-br from-ink-300 to-ink-400" />
        }
        <div className="absolute inset-0 bg-gradient-to-r from-ink-400/98 via-ink-400/75 to-ink-400/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-400/98 via-transparent to-transparent" />
      </div>

      <div className="relative flex flex-col h-full px-6 py-5">
        <div className="flex-1 flex flex-col justify-center max-w-sm">
          <span className="text-xs font-mono text-gold/60 tracking-widest uppercase mb-1">
            {selectedGame?.execPath ? '◈ Configuré' : '◈ Non configuré'}
          </span>

          {/* Game title — synced with selection */}
          <h1 className="font-display font-bold text-white leading-none mb-5" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)' }}>
            {selectedGame?.name ?? '—'}
          </h1>

          {launchError && <p className="text-xs text-red-400 mb-2">{launchError}</p>}

          {/* Play button */}
          <div className="flex items-center gap-3 mb-5">
            <button onClick={handlePlay} disabled={launching}
              className={`flex items-center gap-2.5 px-7 py-3 rounded-xl font-display font-bold tracking-wider transition-all text-base disabled:opacity-70 ${
                isPlaying
                  ? 'bg-red-500/80 text-white hover:bg-red-600 border border-red-400/30'
                  : 'bg-gold text-ink-400 hover:bg-gold-bright shadow-[0_0_24px_rgba(232,184,75,0.35)]'
              }`}>
              {isPlaying ? <Square size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
              {launching ? '...' : isPlaying ? `${t('stop')} ${formatSeconds(sessionTime)}` : t('play')}
            </button>
            {!selectedGame?.execPath && (
              <button onClick={() => setView('games')}
                className="p-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/40 hover:text-gold transition-all">
                <FolderOpen size={15} />
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-white/30" />
              <span className="text-sm text-white/40 font-mono">{fmtTime(selectedGame?.playtime ?? 0)}</span>
            </div>
            {selectedGame?.lastPlayed && (
              <span className="text-sm text-white/30">Il y a {timeAgo(selectedGame.lastPlayed)}</span>
            )}
            <div className="flex items-center gap-1.5">
              <Zap size={13} className="text-gold/50" />
              <span className="text-sm text-gold/60">{activeMods} mods</span>
            </div>
          </div>
        </div>

        {/* Recent games — no labels, only cover art */}
        <div className="flex items-center gap-2 pb-1">
          <span className="text-xs font-mono text-white/25 uppercase tracking-widest mr-1">{t('recent')}</span>
          {[...games]
            .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
            .slice(0, 5)
            .map(game => (
              <button key={game.id} onClick={() => selectGame(game.id)}
                className={`relative rounded-lg overflow-hidden border transition-all flex-shrink-0 ${
                  game.id === selectedGameId
                    ? 'border-gold/60 shadow-[0_0_10px_rgba(232,184,75,0.3)]'
                    : 'border-white/[0.07] opacity-60 hover:opacity-90 hover:border-white/20'
                }`}
                style={{ width: 64, height: 40 }}>
                {game.backgroundArt
                  ? <img src={game.backgroundArt} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-ink-200 flex items-center justify-center">
                      <span className="text-lg font-bold text-gold/40">{game.name[0]}</span>
                    </div>
                }
                {/* No text label — cleaner look */}
              </button>
            ))}
          <button onClick={() => setView('games')}
            className="flex items-center justify-center flex-shrink-0 rounded-lg border border-dashed border-white/[0.08] hover:border-gold/30 opacity-50 hover:opacity-80 transition-all text-xs text-white/40"
            style={{ width: 64, height: 40 }}>
            + →
          </button>
        </div>
      </div>
    </div>
  )
}
