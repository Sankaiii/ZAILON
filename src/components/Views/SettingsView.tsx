import { Globe, Activity, EyeOff, Info, BarChart2, MessageSquare, RefreshCw, Download, Image, CheckCircle, AlertCircle, ExternalLink, Upload, Loader } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useStore, isTauri, invoke, checkGitHubUpdates } from '../../store/useStore'
import { Toggle } from '../UI/Toggle'
import { useT } from '../../i18n'
import { pickImageFile } from '../../utils/dialog'
import type { Lang } from '../../i18n'

type Section = 'general' | 'discord' | 'updates' | 'resources' | 'stats' | 'about'

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'ja', flag: '🇯🇵', label: '日本語' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
]

const APP_VERSION = '1.2.1'

function fmtTime(mins: number) {
  if (!mins) return '0m'
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`
}

export function SettingsView() {
  const { nsfw, toggleNSFW, language, setLanguage, discordPresence, toggleDiscord,
    discordLauncher, discordIngame, setDiscordLauncher, setDiscordIngame,
    games, setGameResource, isPlaying, selectedGame } = useStore()
  const t = useT(language)
  const [section, setSection] = useState<Section>('general')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'uptodate' | 'available' | 'downloading' | 'installing' | 'done'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string; body: string } | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadError, setDownloadError] = useState('')

  // Discord presence
  useEffect(() => {
    if (!isTauri || !discordPresence) { if (isTauri) invoke('discord_stop').catch(() => {}); return }
    if (isPlaying && selectedGame && discordIngame) {
      invoke('discord_start', { state: `Joue à ${selectedGame.name}`, details: 'ZAILON Launcher' }).catch(() => {})
    } else if (discordLauncher) {
      invoke('discord_start', { state: 'Navigue dans le launcher', details: 'ZAILON Launcher' }).catch(() => {})
    }
  }, [discordPresence, discordLauncher, discordIngame, isPlaying, selectedGame])

  const totalPlaytime = games.reduce((a, g) => a + (g.playtime ?? 0), 0)
  const totalMods = games.reduce((a, g) => a + g.mods.length, 0)

  const checkUpdate = async () => {
    setUpdateStatus('checking')
    setDownloadError('')
    try {
      const info = await checkGitHubUpdates()
      setUpdateInfo(info.available ? info : null)
      setUpdateStatus(info.available ? 'available' : 'uptodate')
    } catch { setUpdateStatus('uptodate') }
  }

  // Auto-check on open
  useEffect(() => { checkUpdate() }, [])

  const downloadAndInstall = async () => {
    if (!updateInfo || !isTauri) return
    setUpdateStatus('downloading')
    setDownloadProgress(0)
    setDownloadError('')
    try {
      const tempDir = await invoke<string>('get_temp_dir')
      const platform = navigator.platform.toLowerCase()
      const isWin = platform.includes('win')
      const isMac = platform.includes('mac')
      const fileName = isWin
        ? `ZAILON_${updateInfo.version}_x64-setup.exe`
        : isMac
        ? `ZAILON_${updateInfo.version}_x64.dmg`
        : `ZAILON_${updateInfo.version}_amd64.AppImage`
      const downloadUrl = `https://github.com/Sankaiii/ZAILON/releases/download/v${updateInfo.version}/${fileName}`
      const installerPath = `${tempDir}\\${fileName}`.replace(/\//g, '\\')

      // Stream download with progress
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error(`Download failed: ${response.statusText}`)
      const contentLength = parseInt(response.headers.get('content-length') || '0')
      const reader = response.body!.getReader()
      const chunks: number[] = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        value.forEach(b => chunks.push(b))
        received += value.length
        if (contentLength > 0) setDownloadProgress(Math.floor((received / contentLength) * 100))
      }
      setDownloadProgress(100)
      setUpdateStatus('installing')

      // Write to disk
      await invoke('write_file', { path: installerPath, data: chunks })
      // Run installer
      await invoke('install_update', { installerPath })
      setUpdateStatus('done')
    } catch (e) {
      setDownloadError(String(e))
      setUpdateStatus('available')
    }
  }

  const pickResource = async (gameId: string, type: 'background' | 'icon' | 'logo') => {
    const p = await pickImageFile()
    if (p) setGameResource(gameId, type, p)
  }

  const NAV = [
    { id: 'general', icon: Globe, label: t('language') },
    { id: 'discord', icon: MessageSquare, label: 'Discord' },
    { id: 'updates', icon: RefreshCw, label: t('updates') },
    { id: 'resources', icon: Image, label: t('resources') },
    { id: 'stats', icon: BarChart2, label: t('stats') },
    { id: 'about', icon: Info, label: t('about') },
  ] as const

  return (
    <div className="flex h-full">
      <div className="w-36 border-r border-white/[0.05] py-3 flex flex-col gap-0.5 px-2 flex-shrink-0">
        {NAV.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setSection(id)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-body transition-all ${
              section === id ? 'bg-gold/12 text-gold border border-gold/20' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent'
            }`}>
            <Icon size={13} />{label}
            {id === 'updates' && updateStatus === 'available' && (
              <span className="ml-auto w-2 h-2 rounded-full bg-gold animate-pulse" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto scrollbar-hide">

        {/* GENERAL */}
        {section === 'general' && (
          <div className="space-y-5">
            <SL icon={<Globe size={13} />} label={t('language')} />
            <div className="grid grid-cols-3 gap-1.5">
              {LANGS.map(l => (
                <button key={l.code} onClick={() => setLanguage(l.code)}
                  className={`px-2 py-2 rounded-lg text-xs flex items-center gap-1.5 justify-center transition-all ${
                    language === l.code ? 'bg-gold/15 text-gold border border-gold/25' : 'bg-white/[0.04] text-white/40 hover:text-white/70 border border-white/[0.05]'
                  }`}>
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
            <TR icon={<EyeOff size={12} />} label={t('nsfw')} sub={t('nsfw_sub')} checked={nsfw} onChange={toggleNSFW} />
          </div>
        )}

        {/* DISCORD */}
        {section === 'discord' && (
          <div className="space-y-4">
            <SL icon={<MessageSquare size={13} />} label="Discord Rich Presence" />
            <div className="p-3 rounded-xl bg-indigo-500/[0.07] border border-indigo-400/15">
              <p className="text-xs text-indigo-300/70">
                App ID : <span className="font-mono text-indigo-200/90">1509971526987022497</span>
              </p>
            </div>
            <TR icon={<MessageSquare size={12} />} label={t('discord_presence')} sub="Activer la présence Discord" checked={discordPresence} onChange={toggleDiscord} />
            {discordPresence && (
              <div className="space-y-2 pl-2 border-l-2 border-white/[0.06]">
                <TR icon={<Activity size={12} />} label="Dans le launcher" sub='Affiche "Navigue dans le launcher"' checked={discordLauncher} onChange={() => setDiscordLauncher(!discordLauncher)} />
                <TR icon={<Activity size={12} />} label="En jeu" sub='Affiche "Joue à [Nom du jeu]"' checked={discordIngame} onChange={() => setDiscordIngame(!discordIngame)} />
              </div>
            )}
            {discordPresence && (
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-[10px] text-white/40 font-mono">
                  Statut actuel : {isPlaying && selectedGame ? `🎮 Joue à ${selectedGame.name}` : '📂 Navigue dans ZAILON'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* UPDATES */}
        {section === 'updates' && (
          <div className="space-y-4">
            <SL icon={<RefreshCw size={13} />} label={t('updates')} />
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/40 font-mono">Version installée</p>
                <p className="font-display font-bold text-xl text-white">v{APP_VERSION}</p>
              </div>
              {updateStatus === 'uptodate' && <div className="flex items-center gap-1.5 text-sm text-green-400"><CheckCircle size={14} />À jour</div>}
              {updateStatus === 'available' && updateInfo && (
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-sm text-gold"><AlertCircle size={14} />v{updateInfo.version} disponible</div>
                </div>
              )}
            </div>

            {/* Check button */}
            {(updateStatus === 'idle' || updateStatus === 'checking' || updateStatus === 'uptodate') && (
              <button onClick={checkUpdate} disabled={updateStatus === 'checking'}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm border transition-all text-white/80 border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] disabled:opacity-40">
                <RefreshCw size={13} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
                {updateStatus === 'checking' ? 'Vérification...' : 'Vérifier les mises à jour'}
              </button>
            )}

            {/* Download + install */}
            {updateStatus === 'available' && (
              <div className="space-y-2">
                {downloadError && <p className="text-xs text-red-400">{downloadError}</p>}
                <button onClick={downloadAndInstall}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-display font-bold bg-gold text-ink-400 hover:bg-gold-bright transition-all">
                  <Download size={13} /> Télécharger et installer v{updateInfo?.version}
                </button>
                <p className="text-[10px] text-white/30 text-center font-mono">L'app se ferme et redémarre après l'installation.</p>
              </div>
            )}

            {/* Download progress */}
            {updateStatus === 'downloading' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Téléchargement...</span>
                  <span className="font-mono">{downloadProgress}%</span>
                </div>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-gold transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
                </div>
              </div>
            )}

            {updateStatus === 'installing' && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gold/[0.06] border border-gold/15">
                <Loader size={14} className="text-gold animate-spin" />
                <p className="text-sm text-gold/80">Installation en cours...</p>
              </div>
            )}

            {updateStatus === 'done' && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/[0.08] border border-green-400/15">
                <CheckCircle size={14} className="text-green-400" />
                <p className="text-sm text-green-300/80">Installé ! Redémarre l'app pour finaliser.</p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-gold/[0.04] border border-gold/10">
              <p className="text-[10px] text-gold/60 font-mono">Mises à jour additives — mods, jeux et temps de jeu jamais effacés.</p>
            </div>
          </div>
        )}

        {/* RESOURCES */}
        {section === 'resources' && (
          <div className="space-y-4">
            <SL icon={<Image size={13} />} label={t('resources')} />
            {games.length === 0 && <p className="text-sm text-white/30 text-center py-4">Ajoute des jeux pour configurer leurs ressources.</p>}
            {games.map(game => (
              <div key={game.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <p className="text-sm font-medium text-white/80 mb-3">{game.name}</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'background' as const, label: 'Fond', has: !!game.backgroundArt },
                    { key: 'icon' as const, label: 'Icône', has: !!game.iconUrl },
                    { key: 'logo' as const, label: 'Logo', has: false },
                  ]).map(({ key, label, has }) => (
                    <button key={key} onClick={() => pickResource(game.id, key)}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all group ${
                        has ? 'border-gold/30 bg-gold/[0.06]' : 'border-dashed border-white/[0.08] hover:border-gold/30'
                      }`}>
                      {has ? <Upload size={14} className="text-gold/60" /> : <Image size={14} className="text-white/20 group-hover:text-gold/50" />}
                      <span className="text-xs text-white/60">{label}</span>
                      <span className="text-[9px] text-white/20 font-mono">{has ? '✓ Défini' : 'Cliquer'}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STATS */}
        {section === 'stats' && (
          <div className="space-y-4">
            <SL icon={<BarChart2 size={13} />} label={t('stats')} />
            <div className="flex justify-between p-3 rounded-xl bg-gold/[0.06] border border-gold/15">
              <div>
                <p className="text-[10px] text-gold/60 font-mono uppercase tracking-widest">Total</p>
                <p className="font-display font-bold text-2xl text-gold">{fmtTime(totalPlaytime)}</p>
              </div>
              <div className="text-right text-sm text-white/30">
                <p>{games.length} jeux</p><p>{totalMods} mods</p>
              </div>
            </div>
            {[...games].sort((a, b) => (b.playtime ?? 0) - (a.playtime ?? 0)).map(game => {
              const pct = totalPlaytime > 0 ? ((game.playtime ?? 0) / totalPlaytime) * 100 : 0
              return (
                <div key={game.id} className="py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm text-white/70 truncate">{game.name}</span>
                    <span className="text-sm font-mono text-gold/70">{fmtTime(game.playtime ?? 0)}</span>
                  </div>
                  <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-gold/60" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ABOUT */}
        {section === 'about' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gold/[0.04] border border-gold/10">
              <div className="w-12 h-12 rounded-xl bg-gold flex items-center justify-center flex-shrink-0">
                <span className="font-display font-black text-ink-400 text-xl">Z</span>
              </div>
              <div>
                <p className="font-display font-bold text-lg text-white">ZAILON</p>
                <p className="text-xs text-white/40">Universal Mod Launcher</p>
                <p className="text-xs text-gold/60 font-mono">v{APP_VERSION}</p>
              </div>
            </div>
            <div className="space-y-2">
              {[['Créé par','@souanpt'],['GitHub','Sankaiii/ZAILON'],['Discord App ID','1509971526987022497'],['Stack','React · TypeScript · Tauri v2'],['Plateformes','Windows · Linux · macOS']].map(([k,v]) => (
                <div key={k} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <span className="text-[10px] font-mono text-white/30">{k}</span>
                  <span className="text-sm text-white/60 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SL({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex items-center gap-2 mb-3"><span className="text-gold/60">{icon}</span><span className="text-xs font-mono text-white/40 uppercase tracking-widest">{label}</span></div>
}
function TR({ icon, label, sub, checked, onChange }: { icon: React.ReactNode; label: string; sub: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <div className="flex items-center gap-2">
        <span className="text-white/40">{icon}</span>
        <div><p className="text-sm text-white/70">{label}</p><p className="text-xs text-white/30">{sub}</p></div>
      </div>
      <Toggle checked={checked} onChange={onChange} size="sm" />
    </div>
  )
}
