import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ViewType, Platform, ExplodMod } from '../types'
import type { Lang } from '../i18n'

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) throw new Error('Not in Tauri')
  const { invoke: ti } = await import('@tauri-apps/api/core')
  return ti<T>(cmd, args)
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RealMod {
  id: string; name: string; path: string; enabled: boolean; mod_type: string; size_mb: number
}

export interface RealGame {
  id: string; name: string; execPath: string; modsPath: string
  backgroundArt?: string; iconUrl?: string; logoUrl?: string
  mods: RealMod[]; playtime: number; lastPlayed?: number; gamebananaId?: number
}

export interface GBMod {
  id: number; name: string; author: string; downloads: number
  likes: number; thumbnail: string; url: string; description: string
}

export const MOCK_EXPLORE: ExplodMod[] = [
  { id: 'e1', name: 'HD Character Textures', author: 'ArtModder', game: 'NTE', thumbnail: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=300&q=60', downloads: 48200, rating: 4.9, tags: ['Character'], nsfw: false, platform: 'gamebanana', url: 'https://gamebanana.com', description: 'Retexture pack.' },
  { id: 'e2', name: 'ReShade Cinematic', author: 'FXLab', game: 'All', thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=60', downloads: 89400, rating: 4.8, tags: ['Graphics'], nsfw: false, platform: 'nexus', url: 'https://nexusmods.com', description: 'Cinematic preset.' },
]

// ─── Store ────────────────────────────────────────────────────────────────────
interface Store {
  currentView: ViewType; games: RealGame[]; selectedGameId: string | null
  nsfw: boolean; language: Lang; discordPresence: boolean
  discordLauncher: boolean; discordIngame: boolean
  isPlaying: boolean; playStartTime?: number; sessionTime: number
  explorePlatform: Platform; exploreGame: string; exploreSearch: string; exploreGrid: boolean
  isScanning: boolean; isDetecting: boolean

  selectedGame: RealGame | null

  setView: (v: ViewType) => void
  selectGame: (id: string) => void
  addGameManual: (game: RealGame) => void
  addGames: (games: RealGame[]) => void
  removeGame: (id: string) => void
  setGamePath: (id: string, path: string) => void
  setModsPath: (id: string, path: string) => void
  setGameResource: (id: string, type: 'background' | 'icon' | 'logo', path: string) => void
  scanMods: (gameId: string) => Promise<void>
  toggleMod: (gameId: string, modId: string) => Promise<void>
  deleteMod: (gameId: string, modId: string) => Promise<void>
  detectGames: () => Promise<void>
  startPlaying: () => void; stopPlaying: () => void; tick: () => void
  toggleNSFW: () => void; setLanguage: (l: Lang) => void
  toggleDiscord: () => void; setDiscordLauncher: (v: boolean) => void; setDiscordIngame: (v: boolean) => void
  setExplorePlatform: (p: Platform) => void; setExploreGame: (g: string) => void
  setExploreSearch: (s: string) => void; setExploreGrid: (g: boolean) => void
  installMod: (gameId: string, url: string, fileName: string) => Promise<void>
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      currentView: 'home', games: [], selectedGameId: null,
      nsfw: false, language: 'fr', discordPresence: false,
      discordLauncher: true, discordIngame: true,
      isPlaying: false, sessionTime: 0,
      explorePlatform: 'gamebanana', exploreGame: 'all', exploreSearch: '',
      exploreGrid: true, isScanning: false, isDetecting: false,

      get selectedGame() {
        const s = get()
        return s.games.find(g => g.id === s.selectedGameId) ?? s.games[0] ?? null
      },

      setView: (v) => set({ currentView: v }),
      selectGame: (id) => set({ selectedGameId: id }),

      addGameManual: (game) => set(s => ({
        games: [...s.games, game],
        selectedGameId: s.selectedGameId ?? game.id,
      })),

      addGames: (newGames) => {
        const existing = get().games.map(g => g.execPath)
        const toAdd = newGames.filter(g => !existing.includes(g.execPath))
        if (toAdd.length === 0) return
        set(s => ({
          games: [...s.games, ...toAdd],
          selectedGameId: s.selectedGameId ?? toAdd[0]?.id ?? null,
        }))
      },

      removeGame: (id) => set(s => ({
        games: s.games.filter(g => g.id !== id),
        selectedGameId: s.selectedGameId === id
          ? (s.games.find(g => g.id !== id)?.id ?? null)
          : s.selectedGameId,
      })),

      setGamePath: (id, path) => set(s => ({
        games: s.games.map(g => g.id === id
          ? { ...g, execPath: path, name: path.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') || g.name }
          : g),
      })),

      setModsPath: (id, path) => set(s => ({
        games: s.games.map(g => g.id === id ? { ...g, modsPath: path } : g),
      })),

      setGameResource: (id, type, path) => {
        const fileUrl = isTauri ? `asset://${path}` : path
        set(s => ({
          games: s.games.map(g => {
            if (g.id !== id) return g
            if (type === 'background') return { ...g, backgroundArt: fileUrl }
            if (type === 'icon') return { ...g, iconUrl: fileUrl }
            return { ...g, logoUrl: fileUrl }
          }),
        }))
      },

      scanMods: async (gameId) => {
        const game = get().games.find(g => g.id === gameId)
        if (!game) return
        set({ isScanning: true })
        try {
          let modsPath = game.modsPath
          if (!modsPath && isTauri) {
            const p = await invoke<string|null>('pick_folder').catch(() => null)
            if (!p) { set({ isScanning: false }); return }
            modsPath = p
          }
          const mods = isTauri ? await invoke<RealMod[]>('scan_mods', { modsPath }) : []
          set(s => ({
            isScanning: false,
            games: s.games.map(g => g.id === gameId ? { ...g, modsPath, mods } : g),
          }))
        } catch { set({ isScanning: false }) }
      },

      toggleMod: async (gameId, modId) => {
        const game = get().games.find(g => g.id === gameId)
        const mod = game?.mods.find(m => m.id === modId)
        if (!mod) return
        try {
          const newPath = isTauri ? await invoke<string>('toggle_mod', { modPath: mod.path, enable: !mod.enabled }) : mod.path
          set(s => ({
            games: s.games.map(g => g.id === gameId ? {
              ...g, mods: g.mods.map(m => m.id === modId ? { ...m, enabled: !m.enabled, id: newPath, path: newPath } : m)
            } : g)
          }))
        } catch (e) { console.error(e) }
      },

      deleteMod: async (gameId, modId) => {
        const game = get().games.find(g => g.id === gameId)
        const mod = game?.mods.find(m => m.id === modId)
        if (!mod) return
        if (isTauri) await invoke('delete_mod', { modPath: mod.path }).catch(console.error)
        set(s => ({
          games: s.games.map(g => g.id === gameId ? { ...g, mods: g.mods.filter(m => m.id !== modId) } : g)
        }))
      },

      detectGames: async () => {
        if (!isTauri) return
        set({ isDetecting: true })
        try {
          const detected = await invoke<{ name: string; path: string; exec_path: string; game_id: number }[]>('detect_games')
          // Return detected — modal will handle adding
          set({ isDetecting: false })
          return detected as any
        } catch { set({ isDetecting: false }) }
      },

      startPlaying: () => set({ isPlaying: true, playStartTime: Date.now(), sessionTime: 0 }),
      stopPlaying: () => {
        const s = get()
        if (s.isPlaying && s.playStartTime && s.selectedGameId) {
          const mins = Math.floor((Date.now() - s.playStartTime) / 60000)
          set(st => ({
            isPlaying: false, playStartTime: undefined,
            games: st.games.map(g => g.id === st.selectedGameId
              ? { ...g, playtime: (g.playtime ?? 0) + mins, lastPlayed: Date.now() }
              : g),
          }))
        } else set({ isPlaying: false, playStartTime: undefined })
      },
      tick: () => {
        const s = get()
        if (s.isPlaying && s.playStartTime) set({ sessionTime: Math.floor((Date.now() - s.playStartTime) / 1000) })
      },

      toggleNSFW: () => set(s => ({ nsfw: !s.nsfw })),
      setLanguage: (l) => set({ language: l }),
      toggleDiscord: () => set(s => ({ discordPresence: !s.discordPresence })),
      setDiscordLauncher: (v) => set({ discordLauncher: v }),
      setDiscordIngame: (v) => set({ discordIngame: v }),
      setExplorePlatform: (p) => set({ explorePlatform: p }),
      setExploreGame: (g) => set({ exploreGame: g }),
      setExploreSearch: (s) => set({ exploreSearch: s }),
      setExploreGrid: (g) => set({ exploreGrid: g }),

      installMod: async (gameId, url, fileName) => {
        const game = get().games.find(g => g.id === gameId)
        if (!game?.modsPath || !isTauri) return
        await invoke('ensure_dir', { path: game.modsPath }).catch(console.error)
        await downloadAndInstallMod(url, fileName, game.modsPath)
        await get().scanMods(gameId)
      },
    }),
    {
      name: 'zailon-v3',
      partialize: s => ({
        games: s.games, selectedGameId: s.selectedGameId,
        nsfw: s.nsfw, language: s.language, discordPresence: s.discordPresence,
        discordLauncher: s.discordLauncher, discordIngame: s.discordIngame,
      }),
    }
  )
)

// ─── GameBanana API (JS fetch) ────────────────────────────────────────────────
export async function fetchGBMods(gameId: number, search: string, page: number): Promise<GBMod[]> {
  try {
    const base = 'https://api.gamebanana.com'
    const fields = 'id,name,Owner().name,Downloads().nDownloadCount(),Likes().nCount(),Preview().sSubFeedImageUrl(),description'
    const url = search
      ? `${base}/Core/List/Like?itemtype=Mod&field=name&match=${encodeURIComponent(search)}&gameid=${gameId}&nPerPage=20&nPage=${page}&fields=${fields}`
      : `${base}/Core/List/New?gameid=${gameId}&itemtype=Mod&nPerPage=20&nPage=${page}&fields=${fields}`
    const res = await fetch(url)
    const raw = await res.json()
    if (!Array.isArray(raw)) return []
    return raw.map((item: unknown[]) => ({
      id: Number(item[0]) || 0,
      name: String(item[1] || ''),
      author: String(item[2] || 'Unknown'),
      downloads: Number(item[3]) || 0,
      likes: Number(item[4]) || 0,
      thumbnail: String(item[5] || ''),
      url: `https://gamebanana.com/mods/${item[0]}`,
      description: String(item[6] || ''),
    }))
  } catch { return [] }
}

export async function fetchGBFiles(modId: number): Promise<{ id: number; name: string; url: string; size: number }[]> {
  try {
    const res = await fetch(`https://api.gamebanana.com/Core/Item/Data?itemtype=Mod&itemid=${modId}&fields=Files().aFiles()`)
    const raw = await res.json()
    const fileMap = raw?.[0]
    if (!fileMap || typeof fileMap !== 'object') return []
    return Object.values(fileMap as Record<string, Record<string, unknown>>)
      .map(f => ({ id: Number(f._idRow)||0, name: String(f._sFile||'mod.zip'), url: String(f._sDownloadUrl||''), size: Number(f._nFilesize)||0 }))
      .filter(f => f.url)
  } catch { return [] }
}

export async function checkGitHubUpdates(): Promise<{ available: boolean; version: string; url: string; body: string }> {
  try {
    const res = await fetch('https://api.github.com/repos/Sankaiii/ZAILON/releases/latest', { headers: { 'User-Agent': 'ZAILON/1.0' } })
    const j = await res.json()
    const v = (j.tag_name || '').replace(/^v/, '')
    return { available: !!v && v !== '1.1.2', version: v, url: j.html_url || '', body: j.body || '' }
  } catch { return { available: false, version: '', url: '', body: '' } }
}

export async function downloadAndInstallMod(url: string, fileName: string, modsPath: string): Promise<void> {
  const res = await fetch(url)
  const bytes = await res.arrayBuffer()
  const data = Array.from(new Uint8Array(bytes))
  if (fileName.endsWith('.zip')) {
    await invoke('extract_zip_bytes', { data, destPath: `${modsPath}/${fileName.replace('.zip', '')}` })
  } else {
    await invoke('write_file', { path: `${modsPath}/${fileName}`, data })
  }
}
