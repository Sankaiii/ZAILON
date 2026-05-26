import { Globe, Activity, EyeOff, Info, BarChart2, MessageSquare, RefreshCw, Download, Image, CheckCircle, AlertCircle, ExternalLink, Upload } from 'lucide-react'
import { useState } from 'react'
import { useStore, isTauri, invoke, checkGitHubUpdates } from '../../store/useStore'
import { Toggle } from '../UI/Toggle'
import { useT, T } from '../../i18n'
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

function fmtTime(mins: number) {
  if (!mins) return '0m'
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`
}

export function SettingsView() {
  const { nsfw, toggleNSFW, language, setLanguage, discordPresence, toggleDiscord,
    discordLauncher, discordIngame, setDiscordLauncher, setDiscordIngame,
    games, setGameResource } = useStore()
  const t = useT(language)
  const [section, setSection] = useState<Section>('general')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'uptodate' | 'available'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string } | null>(null)

  const totalPlaytime = games.reduce((a, g) => a + (g.playtime ?? 0), 0)
  const totalMods = games.reduce((a, g) => a + g.mods.length, 0)

  const checkUpdate = async () => {
    setUpdateStatus('checking')
    const info = await checkGitHubUpdates()
    setUpdateInfo(info.available ? info : null)
    setUpdateStatus(info.available ? 'available' : 'uptodate')
  }

  const pickResource = async (gameId: string, type: 'background' | 'icon' | 'logo') => {
    if (!isTauri) return
    const p = await invoke<string|null>('pick_file').catch(() => null)
    if (p) setGameResource(gameId, type, p)
  }

  const NAV = [
    { id: 'general', icon: Activity, label: t('settings') },
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
                  className={`px-2 py-2 rounded-lg text-xs font-body text-center flex items-center gap-1.5 justify-center transition-all ${
                    language === l.code ? 'bg-gold/15 text-gold border border-gold/25' : 'bg-white/[0.04] text-white/40 hover:text-white/70 border border-white/[0.05]'
                  }`}>
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
            <div className="pt-2">
              <SL icon={<EyeOff size={13} />} label="Contenu" />
              <TR icon={<EyeOff size={12} />} label={t('nsfw')} sub={t('nsfw_sub')} checked={nsfw} onChange={toggleNSFW} />
            </div>
          </div>
        )}

        {/* DISCORD */}
        {section === 'discord' && (
          <div className="space-y-4">
            <SL icon={<MessageSquare size={13} />} label="Discord Rich Presence" />
            <div className="p-3 rounded-xl bg-indigo-500/[0.07] border border-indigo-400/15 mb-2">
              <p className="text-xs text-indigo-300/70">Affiche ton activité ZAILON dans Discord.</p>
            </div>
            <TR icon={<MessageSquare size={12} />} label={t('discord_presence')} sub="Activer la présence Discord" checked={discordPresence} onChange={toggleDiscord} />
            {discordPresence && (
              <div className="space-y-2 pl-2 border-l-2 border-white/[0.06]">
                <TR icon={<Activity size={12} />} label={t('discord_launcher')} sub="Présence quand launcher ouvert" checked={discordLauncher} onChange={() => setDiscordLauncher(!discordLauncher)} />
                <TR icon={<Activity size={12} />} label={t('discord_ingame')} sub="Présence quand jeu en cours" checked={discordIngame} onChange={() => setDiscordIngame(!discordIngame)} />
              </div>
            )}
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <p className="text-[10px] text-white/25 font-mono">La présence Discord sera complète dans la prochaine mise à jour (nécessite un Discord App ID).</p>
            </div>
          </div>
        )}

        {/* UPDATES */}
        {section === 'updates' && (
          <div className="space-y-4">
            <SL icon={<RefreshCw size={13} />} label={t('updates')} />
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/40 font-mono">Version actuelle</p>
                <p className="font-display font-bold text-xl text-white">v1.1.2</p>
              </div>
              {updateStatus === 'uptodate' && <div className="flex items-center gap-1.5 text-sm text-green-400"><CheckCircle size={14} />{t('up_to_date')}</div>}
              {updateStatus === 'available' && updateInfo && <div className="text-right"><div className="flex items-center gap-1.5 text-sm text-gold"><AlertCircle size={14} />v{updateInfo.version}</div></div>}
            </div>
            <button onClick={checkUpdate} disabled={updateStatus === 'checking'}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-body font-medium border transition-all ${
                updateStatus === 'checking' ? 'text-white/30 border-white/[0.05] cursor-not-allowed' : 'text-white/80 border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07]'
              }`}>
              <RefreshCw size={13} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
              {updateStatus === 'checking' ? 'Vérification...' : t('check_updates')}
            </button>
            {updateStatus === 'available' && updateInfo && (
              <button onClick={async () => { if (isTauri) await invoke('open_url', { url: updateInfo.url }); else window.open(updateInfo.url, '_blank') }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-display font-bold bg-gold text-ink-400 hover:bg-gold-bright transition-all">
                <Download size={13} /> {t('download_update')} <ExternalLink size={11} />
              </button>
            )}
            <div className="p-3 rounded-lg bg-gold/[0.04] border border-gold/10">
              <p className="text-[10px] text-gold/60 font-mono">Les mises à jour sont additives — mods, profils et temps de jeu jamais effacés.</p>
            </div>
          </div>
        )}

        {/* RESOURCES */}
        {section === 'resources' && (
          <div className="space-y-4">
            <SL icon={<Image size={13} />} label={t('resources')} />
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-xs text-white/50 leading-relaxed">Personnalise chaque jeu avec un fond, une icône ou un logo custom.</p>
            </div>
            {games.length === 0 && <p className="text-xs text-white/30 text-center py-4">Ajoute des jeux pour configurer leurs ressources.</p>}
            {games.map(game => (
              <div key={game.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.09] transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-white/80">{game.name}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'background', label: 'Fond', sub: '.jpg .png .mp4' },
                    { key: 'icon', label: 'Icône', sub: '.png .ico' },
                    { key: 'logo', label: 'Logo', sub: '.png .svg' },
                  ] as const).map(({ key, label, sub }) => {
                    const hasValue = key === 'background' ? !!game.backgroundArt : key === 'icon' ? !!game.iconUrl : false
                    return (
                      <button key={key} onClick={() => pickResource(game.id, key)}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all group ${
                          hasValue ? 'border-gold/30 bg-gold/[0.06] hover:bg-gold/[0.1]' : 'border-dashed border-white/[0.08] hover:border-gold/30 hover:bg-gold/[0.03]'
                        }`}>
                        {hasValue
                          ? <Upload size={14} className="text-gold/60 group-hover:text-gold transition-colors" />
                          : <Image size={14} className="text-white/20 group-hover:text-gold/50 transition-colors" />
                        }
                        <span className="text-xs text-white/60 group-hover:text-white/90">{label}</span>
                        <span className="text-[9px] text-white/20 font-mono">{hasValue ? '✓ Défini' : sub}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STATS */}
        {section === 'stats' && (
          <div className="space-y-4">
            <SL icon={<BarChart2 size={13} />} label={t('stats')} />
            <div className="flex items-center justify-between p-3 rounded-xl bg-gold/[0.06] border border-gold/15">
              <div>
                <p className="text-[10px] text-gold/60 font-mono uppercase tracking-widest">{t('total_playtime')}</p>
                <p className="font-display font-bold text-2xl text-gold">{fmtTime(totalPlaytime)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/30">{games.length} jeux</p>
                <p className="text-sm text-white/30">{totalMods} mods</p>
              </div>
            </div>
            {[...games].sort((a, b) => (b.playtime ?? 0) - (a.playtime ?? 0)).map(game => {
              const pct = totalPlaytime > 0 ? ((game.playtime ?? 0) / totalPlaytime) * 100 : 0
              return (
                <div key={game.id} className="py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-white/70 truncate">{game.name}</span>
                    <span className="text-sm font-mono text-gold/70">{fmtTime(game.playtime ?? 0)}</span>
                  </div>
                  <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-gold/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {games.length === 0 && <p className="text-sm text-white/30 text-center py-4">Lance un jeu pour voir tes stats.</p>}
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
                <p className="text-xs text-gold/60 font-mono mt-0.5">v1.1.2 — Stable</p>
              </div>
            </div>
            <div className="space-y-2">
              {[['Créé par','@souanpt'],['GitHub','Sankaiii/ZAILON'],['Licence','Open Source'],['Stack','React · TypeScript · Tauri'],['Plateformes','Windows · Linux · macOS']].map(([k,v]) => (
                <div key={k} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <span className="text-[10px] font-mono text-white/30">{k}</span>
                  <span className="text-sm text-white/60">{v}</span>
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
        <div><p className="text-sm font-body text-white/70">{label}</p><p className="text-xs text-white/30">{sub}</p></div>
      </div>
      <Toggle checked={checked} onChange={onChange} size="sm" />
    </div>
  )
}
