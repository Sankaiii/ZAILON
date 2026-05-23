import { Search, Download, Star, Grid, List, ExternalLink, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore, MOCK_EXPLORE, GBMod, fetchGBMods, fetchGBFiles, downloadAndInstallMod } from '../../store/useStore'
import { useT } from '../../i18n'
import { Platform } from '../../types'
import { Toggle } from '../UI/Toggle'
import { PLATFORM_COLORS, PLATFORM_LABELS, formatDownloads } from '../../utils'

const PLATFORMS: Platform[] = ['gamebanana', 'nexus', 'curseforge', 'ayakamods']

const GB_GAME_IDS: Record<string, number> = {
  'all': 20920,
  'Neverness to Everness': 20920,
  'Genshin Impact': 7545,
  'Honkai: Star Rail': 18874,
  'Zenless Zone Zero': 20292,
  'Wuthering Waves': 20545,
  'Cyberpunk 2077': 7371,
}

export function ExploreView() {
  const { games, selectedGame, explorePlatform, exploreGame, exploreSearch, exploreGrid, nsfw,
    setExplorePlatform, setExploreGame, setExploreSearch, setExploreGrid, language } = useStore()
  const t = useT(language)

  const [page, setPage] = useState(1)
  const [mods, setMods] = useState<GBMod[]>([])
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<number | null>(null)
  const [installed, setInstalled] = useState<Set<number>>(new Set())
  const [files, setFiles] = useState<Record<number, { id: number; name: string; url: string; size: number }[]>>({})
  const [showFiles, setShowFiles] = useState<number | null>(null)
  const gameList = ['all', ...games.map(g => g.name)]

  const loadMods = async (gId: number, s: string, p: number) => {
    setLoading(true)
    const result = explorePlatform === 'gamebanana'
      ? await fetchGBMods(gId, s, p)
      : MOCK_EXPLORE.map(m => ({ id: parseInt(m.id), name: m.name, author: m.author, downloads: m.downloads, likes: 0, thumbnail: m.thumbnail, url: m.url, description: m.description }))
    setMods(result)
    setLoading(false)
  }

  useEffect(() => {
    const gId = GB_GAME_IDS[exploreGame] ?? 20920
    loadMods(gId, exploreSearch, page)
  }, [explorePlatform, exploreGame, page])

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    setPage(1)
    const gId = GB_GAME_IDS[exploreGame] ?? 20920
    loadMods(gId, exploreSearch, 1)
  }

  const handleInstall = async (mod: GBMod) => {
    if (!selectedGame?.modsPath) return
    const modFiles = files[mod.id]
    if (!modFiles) {
      const f = await fetchGBFiles(mod.id)
      setFiles(prev => ({ ...prev, [mod.id]: f }))
      if (f.length === 1) {
        setInstalling(mod.id)
        await downloadAndInstallMod(f[0].url, f[0].name, selectedGame.modsPath).catch(console.error)
        await useStore.getState().scanMods(selectedGame.id)
        setInstalled(prev => new Set([...prev, mod.id]))
        setInstalling(null)
      } else { setShowFiles(mod.id) }
      return
    }
    if (modFiles.length === 1) {
      setInstalling(mod.id)
      await downloadAndInstallMod(modFiles[0].url, modFiles[0].name, selectedGame.modsPath).catch(console.error)
      await useStore.getState().scanMods(selectedGame.id)
      setInstalled(prev => new Set([...prev, mod.id]))
      setInstalling(null)
    } else { setShowFiles(mod.id) }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search */}
        <div className="px-3 pt-3 pb-2 border-b border-white/[0.04] flex-shrink-0 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={exploreSearch} onChange={e => setExploreSearch(e.target.value)} onKeyDown={handleSearch}
              placeholder={`${t('search')} (Entrée)`}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs pl-7 pr-3 py-1.5 text-white/80 placeholder-white/25 focus:outline-none focus:border-gold/30" />
          </div>
          {loading && <RefreshCw size={13} className="text-white/30 animate-spin flex-shrink-0" />}
          <button onClick={() => setExploreGrid(!exploreGrid)}
            className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 transition-all flex-shrink-0">
            {exploreGrid ? <List size={13} /> : <Grid size={13} />}
          </button>
        </div>

        {selectedGame && !selectedGame.modsPath && (
          <div className="px-3 py-2 bg-gold/[0.06] border-b border-gold/10 text-xs text-gold/70">
            💡 Configure le dossier mods (Jeux → Settings) pour installer directement.
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
          {mods.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
              <Search size={28} className="text-white/30" />
              <p className="text-sm text-white/40">{t('no_mods')}</p>
            </div>
          )}
          {exploreGrid ? (
            <div className="grid grid-cols-3 gap-2">
              {mods.map(mod => (
                <ModTile key={mod.id} mod={mod} installed={installed.has(mod.id)}
                  installing={installing === mod.id} canInstall={!!selectedGame?.modsPath}
                  onInstall={() => handleInstall(mod)} />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {mods.map(mod => (
                <ModRow key={mod.id} mod={mod} installed={installed.has(mod.id)}
                  installing={installing === mod.id} canInstall={!!selectedGame?.modsPath}
                  onInstall={() => handleInstall(mod)} />
              ))}
            </div>
          )}
          {mods.length > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded text-xs bg-white/[0.04] border border-white/[0.06] text-white/40 disabled:opacity-30 hover:text-white transition-all">←</button>
              <span className="text-xs text-white/30 font-mono">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded text-xs bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white transition-all">→</button>
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-36 border-l border-white/[0.05] flex flex-col flex-shrink-0">
        <div className="px-2.5 pt-3 pb-2">
          <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">Platform</p>
          <div className="space-y-0.5">
            {PLATFORMS.map(p => {
              const color = PLATFORM_COLORS[p]; const active = explorePlatform === p
              return (
                <button key={p} onClick={() => { setExplorePlatform(p); setPage(1) }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: active ? color : '#ffffff30' }} />
                  <span className={`text-xs transition-colors ${active ? 'text-white/90' : 'text-white/40'}`}>{PLATFORM_LABELS[p]}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="mx-2.5 border-t border-white/[0.05]" />
        <div className="px-2.5 pt-2 pb-2">
          <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">Game</p>
          <div className="space-y-0.5">
            {gameList.slice(0, 8).map(g => (
              <button key={g} onClick={() => { setExploreGame(g); setPage(1) }}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-all ${exploreGame === g ? 'text-gold bg-gold/10' : 'text-white/35 hover:text-white/65 hover:bg-white/[0.04]'}`}>
                {g === 'all' ? 'All Games' : g.split(' ').slice(-1)[0]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        <div className="px-2.5 pb-3 flex items-center gap-2">
          <Toggle checked={nsfw} onChange={useStore.getState().toggleNSFW} size="sm" />
          <span className="text-[10px] text-white/30 font-mono">NSFW</span>
        </div>
      </div>

      {/* File picker modal */}
      {showFiles !== null && files[showFiles] && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-ink-200 border border-white/[0.1] rounded-xl p-5 w-80 shadow-2xl">
            <p className="text-sm font-display font-bold text-white mb-3">Choisir un fichier</p>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
              {files[showFiles].map(f => (
                <button key={f.id} onClick={async () => {
                  const modId = showFiles; setShowFiles(null)
                  if (!selectedGame?.modsPath) return
                  setInstalling(modId)
                  await downloadAndInstallMod(f.url, f.name, selectedGame.modsPath).catch(console.error)
                  await useStore.getState().scanMods(selectedGame.id)
                  setInstalled(prev => new Set([...prev, modId]))
                  setInstalling(null)
                }} className="w-full flex items-center justify-between p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-gold/30 transition-all text-left">
                  <span className="text-xs text-white/80 truncate">{f.name}</span>
                  <span className="text-[10px] text-white/30 ml-2 flex-shrink-0">{(f.size/1024/1024).toFixed(1)}MB</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowFiles(null)}
              className="mt-3 w-full py-1.5 bg-white/[0.04] rounded-lg text-xs text-white/50 hover:text-white transition-all">Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ModTile({ mod, installed, installing, canInstall, onInstall }: {
  mod: GBMod; installed: boolean; installing: boolean; canInstall: boolean; onInstall: () => void
}) {
  return (
    <div className="group relative rounded-lg overflow-hidden border border-white/[0.06] hover:border-gold/20 transition-all bg-ink-200">
      <div className="aspect-video relative overflow-hidden">
        <img src={mod.thumbnail || 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=300&q=60'}
          alt={mod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=300&q=60' }} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-300/90 via-transparent to-transparent" />
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-white/90 truncate">{mod.name}</p>
        <p className="text-[10px] text-white/40 truncate">{mod.author}</p>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5 text-[10px] text-gold/60"><Star size={8} fill="currentColor" />{mod.likes}</span>
            <span className="text-[10px] text-white/25">↓{formatDownloads(mod.downloads)}</span>
          </div>
          <div className="flex gap-1">
            <a href={mod.url} target="_blank" rel="noreferrer" className="p-0.5 text-white/20 hover:text-white/60 transition-colors">
              <ExternalLink size={10} />
            </a>
            {canInstall && (
              <button onClick={onInstall} disabled={installing}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all ${installed ? 'text-gold/50 bg-gold/5 cursor-default' : installing ? 'text-white/40' : 'text-ink-400 bg-gold hover:bg-gold-bright'}`}>
                {installing ? '...' : installed ? '✓' : <><Download size={9} /></>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ModRow({ mod, installed, installing, canInstall, onInstall }: {
  mod: GBMod; installed: boolean; installing: boolean; canInstall: boolean; onInstall: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-gold/15 transition-all">
      <img src={mod.thumbnail || 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=300&q=60'}
        alt="" className="w-12 h-8 object-cover rounded flex-shrink-0"
        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=300&q=60' }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white/90 truncate">{mod.name}</p>
        <p className="text-[10px] text-white/35">{mod.author}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] text-white/25">↓{formatDownloads(mod.downloads)}</span>
        {canInstall && (
          <button onClick={onInstall} disabled={installing || installed}
            className={`text-xs px-2 py-0.5 rounded transition-all ${installed ? 'text-gold/40 cursor-default' : installing ? 'text-white/30' : 'text-ink-400 bg-gold hover:bg-gold-bright'}`}>
            {installing ? '...' : installed ? '✓' : 'Install'}
          </button>
        )}
      </div>
    </div>
  )
}
