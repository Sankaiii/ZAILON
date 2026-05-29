import { Plus, FolderOpen, RefreshCw, Search, Trash2, ToggleLeft, ToggleRight, ScanLine, Gamepad2 } from 'lucide-react'
import { useState } from 'react'
import { useStore, invoke, isTauri } from '../../store/useStore'
import { useT } from '../../i18n'
import { DetectGamesModal } from '../UI/DetectGamesModal'
import { pickExeFile, pickFolder } from '../../utils/dialog'

const LOADER_COLORS: Record<string, string> = {
  folder: '#e8b84b', pak: '#60b4f7', asi: '#c8f77e', dll: '#f7a07e',
}

interface DetectedGame { name: string; path: string; exec_path: string; game_id: number }

export function GamesView() {
  const { games, selectedGame, selectedGameId, selectGame, removeGame,
    scanMods, toggleMod, deleteMod, setModsPath, setGamePath,
    isScanning, language, addGames, addGameManual, setGameResource } = useStore()
  const t = useT(language)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'mods' | 'settings'>('mods')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [detected, setDetected] = useState<DetectedGame[] | null>(null)
  const [bypassPath, setBypassPath] = useState(selectedGame?.modsPath?.replace('~mods', 'SignatureBypass') ?? '')

  const filteredMods = selectedGame?.mods.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  ) ?? []
  const active = selectedGame?.mods.filter(m => m.enabled).length ?? 0

  // Add game by selecting .exe directly
  const handleAddGame = async () => {
    const exePath = await pickExeFile()
    if (!exePath) return
    const parts = exePath.replace(/\\/g, '/')
    const fileName = parts.split('/').pop() ?? ''
    const name = fileName.replace(/\.exe$/i, '').replace(/[-_]/g, ' ')
    const id = `g-${Date.now()}`
    // Auto-guess mods path
    const modsPath = isTauri
      ? await invoke<string|null>('guess_mods_path', { execPath: exePath }).catch(() => null) ?? ''
      : ''
    addGameManual({ id, name, execPath: exePath, modsPath, mods: [], playtime: 0, gamebananaId: 0 })
    selectGame(id)
    if (modsPath) await scanMods(id)
  }

  const handleDetect = async () => {
    if (!isTauri) { setDetected([]); return }
    const found = await invoke<DetectedGame[]>('detect_games').catch(() => [] as DetectedGame[])
    setDetected(found)
  }

  const handlePickMods = async () => {
    if (!selectedGame) return
    const p = await pickFolder()
    if (!p) return
    setModsPath(selectedGame.id, p)
    await scanMods(selectedGame.id)
  }

  const handlePickExec = async () => {
    if (!selectedGame) return
    const p = await pickExeFile()
    if (!p) return
    setGamePath(selectedGame.id, p)
    // Auto-guess mods path if not set
    if (!selectedGame.modsPath && isTauri) {
      const modsPath = await invoke<string|null>('guess_mods_path', { execPath: p }).catch(() => null)
      if (modsPath) { setModsPath(selectedGame.id, modsPath); await scanMods(selectedGame.id) }
    }
  }

  const handlePickBypass = async () => {
    const p = await pickFolder()
    if (p) setBypassPath(p)
  }

  return (
    <div className="flex h-full relative">
      {/* Sidebar */}
      <div className="w-44 flex flex-col border-r border-white/[0.05] flex-shrink-0">
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-mono text-white/30 uppercase tracking-widest">{t('games')}</span>
          <div className="flex gap-1">
            <button onClick={handleDetect} title={t('detect')}
              className="p-1.5 rounded hover:bg-white/[0.06] text-white/30 hover:text-gold transition-all">
              <ScanLine size={13} />
            </button>
            <button onClick={handleAddGame} title={t('add_game')}
              className="p-1.5 rounded hover:bg-white/[0.06] text-white/30 hover:text-white transition-all">
              <Plus size={13} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide py-1 px-2 space-y-0.5">
          {games.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-2 opacity-40 text-center px-2">
              <Gamepad2 size={22} className="text-white/30" />
              <button onClick={handleAddGame} className="text-xs text-gold/60 hover:text-gold underline">{t('add_game')}</button>
            </div>
          ) : games.map(game => (
            <button key={game.id} onClick={() => selectGame(game.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-2.5 rounded-xl transition-all text-left ${
                game.id === selectedGameId ? 'bg-gold/12 border border-gold/20' : 'hover:bg-white/[0.04] border border-transparent'
              }`}>
              <div className="w-8 h-8 rounded-lg flex-shrink-0 bg-ink-50 overflow-hidden flex items-center justify-center">
                {game.backgroundArt
                  ? <img src={game.backgroundArt} alt="" className="w-full h-full object-cover opacity-80" />
                  : <span className="text-sm font-bold text-gold/60">{game.name[0]}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium leading-tight truncate ${game.id === selectedGameId ? 'text-gold' : 'text-white/70'}`}>{game.name}</p>
                <p className="text-[10px] text-white/25">{game.mods.length} mods · {game.execPath ? '✓ lié' : '⚠ non lié'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      {!selectedGame ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
          <Gamepad2 size={32} className="text-white/30" />
          <p className="text-sm text-white/40">{t('no_games')}</p>
          <button onClick={handleAddGame} className="text-xs text-gold/60 hover:text-gold underline">{t('add_game')}</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header + tabs */}
          <div className="px-4 pt-3 pb-0 border-b border-white/[0.04] flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display font-bold text-base text-white">{selectedGame.name}</h2>
              <div className="flex gap-1">
                <button onClick={() => { scanMods(selectedGame.id) }} disabled={isScanning} title={t('scan_mods')}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-gold transition-all disabled:opacity-40">
                  <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
                </button>
                <button onClick={handlePickMods} title="Dossier mods"
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white transition-all">
                  <FolderOpen size={13} />
                </button>
                <button onClick={() => setConfirmDelete(selectedGame.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="flex -mx-4 px-4">
              {(['mods', 'settings'] as const).map(tb => (
                <button key={tb} onClick={() => setTab(tb)}
                  className={`px-3 py-1.5 text-xs font-body font-medium transition-all border-b-2 -mb-px ${
                    tab === tb ? 'text-gold border-gold' : 'text-white/30 border-transparent hover:text-white/60'
                  }`}>
                  {tb === 'mods' ? `${t('mods')} (${active}/${selectedGame.mods.length})` : '⚙ Config'}
                </button>
              ))}
              {tab === 'mods' && (
                <div className="flex-1 flex justify-end py-1">
                  <div className="relative">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/25" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
                      className="bg-white/[0.04] border border-white/[0.06] rounded text-xs pl-6 pr-2 py-1 text-white/70 placeholder-white/25 focus:outline-none focus:border-gold/30 w-32" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mods list */}
          {tab === 'mods' && (
            <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
              {!selectedGame.modsPath ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 opacity-70">
                  <FolderOpen size={28} className="text-white/30" />
                  <p className="text-sm text-white/50 text-center">Aucun dossier mods configuré</p>
                  <button onClick={handlePickMods}
                    className="px-4 py-2 rounded-lg bg-gold/15 text-gold border border-gold/25 text-sm hover:bg-gold/25 transition-all">
                    Choisir le dossier mods
                  </button>
                </div>
              ) : filteredMods.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
                  <p className="text-sm text-white/40">{t('no_mods')}</p>
                  <button onClick={() => scanMods(selectedGame.id)} className="text-xs text-gold/60 hover:text-gold underline">{t('scan_mods')}</button>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredMods.map(mod => {
                    const color = LOADER_COLORS[mod.mod_type] ?? '#888'
                    return (
                      <div key={mod.id} className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                        mod.enabled ? 'bg-white/[0.04] border-white/[0.06] hover:border-gold/20' : 'bg-white/[0.02] border-white/[0.03] opacity-60'
                      }`}>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ color, backgroundColor: `${color}20`, border: `1px solid ${color}40` }}>
                          {mod.mod_type.toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white/90 truncate">{mod.name}</p>
                          {mod.size_mb > 0 && <p className="text-[10px] text-white/30">{mod.size_mb} MB</p>}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => deleteMod(selectedGame.id, mod.id)}
                            className="p-1 text-white/30 hover:text-red-400 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <button onClick={() => toggleMod(selectedGame.id, mod.id)}>
                          {mod.enabled
                            ? <ToggleRight size={22} className="text-gold" />
                            : <ToggleLeft size={22} className="text-white/25" />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Settings tab */}
          {tab === 'settings' && (
            <div className="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-hide">
              {/* Exe path */}
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">
                  Executable (.exe) {!selectedGame.execPath && <span className="text-red-400/70">⚠ non configuré</span>}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 flex items-center min-w-0">
                    <span className="text-xs font-mono text-white/50 truncate">
                      {selectedGame.execPath || 'Aucun .exe sélectionné'}
                    </span>
                  </div>
                  <button onClick={handlePickExec}
                    className="px-3 py-2 bg-gold/15 border border-gold/25 rounded-lg text-xs text-gold hover:bg-gold/30 transition-all font-bold flex-shrink-0">
                    Parcourir
                  </button>
                </div>
              </div>

              {/* Mods path */}
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">
                  Dossier mods {!selectedGame.modsPath && <span className="text-yellow-400/70">⚠ non configuré</span>}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 flex items-center min-w-0">
                    <span className="text-xs font-mono text-white/50 truncate">
                      {selectedGame.modsPath || 'Aucun dossier sélectionné'}
                    </span>
                  </div>
                  <button onClick={handlePickMods}
                    className="px-3 py-2 bg-white/[0.06] border border-white/[0.08] rounded-lg text-xs text-white/60 hover:text-white transition-all flex-shrink-0">
                    Parcourir
                  </button>
                </div>
              </div>

              {/* Bypass path */}
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">
                  Dossier Bypass <span className="text-white/20">(optionnel — sig bypass NTE…)</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 flex items-center min-w-0">
                    <span className="text-xs font-mono text-white/30 truncate">{bypassPath || 'Optionnel'}</span>
                  </div>
                  <button onClick={handlePickBypass}
                    className="px-3 py-2 bg-white/[0.06] border border-white/[0.08] rounded-lg text-xs text-white/50 hover:text-white transition-all flex-shrink-0">
                    Parcourir
                  </button>
                </div>
              </div>

              {/* Quick scan */}
              {selectedGame.modsPath && (
                <button onClick={() => scanMods(selectedGame.id)} disabled={isScanning}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white/60 hover:text-white transition-all disabled:opacity-40">
                  <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} />
                  {isScanning ? 'Scan en cours...' : 'Scanner les mods maintenant'}
                </button>
              )}

              <div className="text-xs text-white/25 font-mono pt-1">
                ⏱ {Math.floor((selectedGame.playtime ?? 0) / 60)}h {(selectedGame.playtime ?? 0) % 60}m de jeu
              </div>

              <div className="pt-2 border-t border-white/[0.05]">
                <button onClick={() => setConfirmDelete(selectedGame.id)}
                  className="flex items-center gap-2 text-xs text-red-400/60 hover:text-red-400 transition-colors">
                  <Trash2 size={12} /> Supprimer de ZAILON
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-ink-200 border border-white/[0.1] rounded-xl p-5 w-64 shadow-2xl">
            <p className="text-sm text-white/80 mb-4">Supprimer ce jeu de ZAILON ? (fichiers non effacés)</p>
            <div className="flex gap-2">
              <button onClick={() => { removeGame(confirmDelete); setConfirmDelete(null) }}
                className="flex-1 py-2 bg-red-500/80 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-all">Supprimer</button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 bg-white/[0.06] text-white/60 rounded-lg text-xs hover:bg-white/[0.1] transition-all">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Detect modal */}
      {detected !== null && (
        <DetectGamesModal games={detected} onClose={() => setDetected(null)}
          onAdd={gs => addGames(gs.map(g => ({
            id: `g-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: g.name, execPath: g.exec_path, modsPath: '',
            mods: [], playtime: 0, gamebananaId: g.game_id,
          })))} />
      )}
    </div>
  )
}
