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
  id: string; name: string; path: string; enabled: boolean; mod_type: string; size_mb: number;
}

export interface RealGame {
  id: string; name: string; execPath: string; modsPath: string;
  backgroundArt?: string; iconUrl?: string; mods: RealMod[];
  playtime: number; lastPlayed?: number; gamebananaId?: number;
}

export interface GBMod {
  id: number; name: string; author: string; downloads: number;
  likes: number; thumbnail: string; url: string; description: string;
}

export const MOCK_EXPLORE: ExplodMod[] = [
  { id: 'e1', name: 'HD Character Textures Pack', author: 'ArtModder', game: 'Neverness to Everness', thumbnail: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=300&q=60', downloads: 48200, rating: 4.9, tags: ['Character', 'Texture'], nsfw: false, platform: 'gamebanana', url: 'https://gamebanana.com', description: 'Ultra HD retexture.' },
  { id: 'e2', name: 'ReShade Cinematic', author: 'FXLab', game: 'All Games', thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=60', downloads: 89400, rating: 4.8, tags: ['Graphics', 'ReShade'], nsfw: false, platform: 'nexus', url: 'https://nexusmods.com', description: 'Cinematic preset.' },
]

// ─── Store ────────────────────────────────────────────────────────────────────
interface Store {
  currentView: ViewType; games: RealGame[]; selectedGameId: string | null;
  nsfw: boolean; language: Lang; discordPresence: boolean;
  discordLauncher: boolean; discordIngame: boolean;
  isPlaying: boolean; playStartTime?: number; sessionTime: number;
  explorePlatform: Platform; exploreGame: string; exploreSearch: string; exploreGrid: boolean;
  isScanning: boolean; isDetecting: boolean;
  gbMods: GBMod[]; gbLoading: boolean;

  selectedGame: RealGame | null;
  activeModsCount: number;

  setView: (v: ViewType) => void;
  selectGame: (id: string) => void;
  addGame: () => Promise<void>;
  removeGame: (id: string) => void;
  setGamePath: (id: string, path: string) => void;
  setModsPath: (id: string, path: string) => void;
  scanMods: (gameId: string) => Promise<void>;
  toggleMod: (gameId: string, modId: string) => Promise<void>;
  deleteMod: (gameId: string, modId: string) => Promise<void>;
  detectGames: () => Promise<void>;
  startPlaying: () => void; stopPlaying: () => void; tick: () => void;
  toggleNSFW: () => void; setLanguage: (l: Lang) => void;
  toggleDiscord: () => void; setDiscordLauncher: (v: boolean) => void; setDiscordIngame: (v: boolean) => void;
  setExplorePlatform: (p: Platform) => void; setExploreGame: (g: string) => void;
  setExploreSearch: (s: string) => void; setExploreGrid: (g: boolean) => void;
  fetchGB: (gameId: number, search: string, page: number) => Promise<void>;
  installMod: (gameId: string, url: string, fileName: string) => Promise<void>;
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
      gbMods: [], gbLoading: false,

      get selectedGame() {
        const s = get()
        return s.games.find(g => g.id === s.selectedGameId) ?? s.games[0] ?? null
      },
      get activeModsCount() {
        return get().selectedGame?.mods.filter(m => m.enabled).length ?? 0
      },

      setView: (v) => set({ currentView: v }),
      selectGame: (id) => set({ selectedGameId: id }),

      addGame: async () => {
        if (!isTauri) return
        const path = await invoke<string|null>('pick_folder')
        if (!path) return
        // Try to find exe in picked folder
        let execPath = path
        const name = path.split(/[\\/]/).filter(Boolean).pop() ?? 'Game'
        const id = `g-${Date.now()}`
        set(s => ({
          games: [...s.games, { id, name, execPath, modsPath: '', mods: [], playtime: 0, gamebananaId: 0 }],
          selectedGameId: s.selectedGameId ?? id,
        }))
      },

      removeGame: (id) => set(s => ({
        games: s.games.filter(g => g.id !== id),
        selectedGameId: s.selectedGameId === id ? (s.games.find(g => g.id !== id)?.id ?? null) : s.selectedGameId,
      })),

      setGamePath: (id, path) => set(s => ({
        games: s.games.map(g => g.id === id ? { ...g, execPath: path, name: path.split(/[\\/]/).filter(Boolean).pop() ?? g.name } : g),
      })),

      setModsPath: (id, path) => set(s => ({
        games: s.games.map(g => g.id === id ? { ...g, modsPath: path } : g),
      })),

      scanMods: async (gameId) => {
        const game = get().games.find(g => g.id === gameId)
        if (!game) return
        set({ isScanning: true })
        try {
          let modsPath = game.modsPath
          if (!modsPath && isTauri) {
            const p = await invoke<string|null>('pick_folder')
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
          const existing = get().games.map(g => g.execPath)
          const newGames: RealGame[] = detected
            .filter(d => !existing.includes(d.exec_path))
            .map(d => ({ id: `g-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: d.name, execPath: d.exec_path, modsPath: '', mods: [], playtime: 0, gamebananaId: d.game_id }))
          set(s => ({
            isDetecting: false,
            games: [...s.games, ...newGames],
            selectedGameId: s.selectedGameId ?? newGames[0]?.id ?? null,
          }))
        } catch { set({ isDetecting: false }) }
      },

      startPlaying: () => set({ isPlaying: true, playStartTime: Date.now(), sessionTime: 0 }),

      stopPlaying: () => {
        const s = get()
        if (s.isPlaying && s.playStartTime && s.selectedGameId) {
          const mins = Math.floor((Date.now() - s.playStartTime) / 60000)
          set(st => ({
            isPlaying: false, playStartTime: undefined,
            games: st.games.map(g => g.id === st.selectedGameId ? { ...g, playtime: g.playtime + mins, lastPlayed: Date.now() } : g),
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

      fetchGB: async (gameId, search, page) => {
        if (!isTauri) return
        set({ gbLoading: true })
        try {
          const mods = await invoke<GBMod[]>('fetch_gamebanana', { gameId, search, page })
          set({ gbMods: mods, gbLoading: false })
        } catch { set({ gbLoading: false }) }
      },

      installMod: async (gameId, url, fileName) => {
        const game = get().games.find(g => g.id === gameId)
        if (!game?.modsPath || !isTauri) return
        await invoke('ensure_dir', { path: game.modsPath })
        await invoke('install_mod_from_url', { url, modsPath: game.modsPath, fileName })
        await get().scanMods(gameId)
      },
    }),
    {
      name: 'zailon-v2',
      partialize: s => ({ games: s.games, selectedGameId: s.selectedGameId, nsfw: s.nsfw, language: s.language, discordPresence: s.discordPresence, discordLauncher: s.discordLauncher, discordIngame: s.discordIngame }),
    }
  )
)
