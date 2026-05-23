import { Globe, Activity, EyeOff, Info, BarChart2, MessageSquare, RefreshCw, Download, Image, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useStore, isTauri, invoke } from '../../store/useStore'
import { Toggle } from '../UI/Toggle'
import { useT, T } from '../../i18n'
import type { Lang } from '../../i18n'

type Section = 'general' | 'discord' | 'updates' | 'resources' | 'stats' | 'about'

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
]

function fmtTime(mins: number) {
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`
}

export function SettingsView() {
  const { nsfw, toggleNSFW, language, setLanguage, discordPresence, toggleDiscord,
    discordLauncher, discordIngame, setDiscordLauncher, setDiscordIngame,
    games } = useStore()
  const t = useT(language)
  const [section, setSection] = useState<Section>('general')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'uptodate' | 'available'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string; body: string } | null>(null)

  const totalPlaytime = games.reduce((a, g) => a + g.playtime, 0)
  const totalMods = games.reduce((a, g) => a + g.mods.length, 0)

  const checkUpdate = async () => {
    setUpdateStatus('checking')
    try {
      if (isTauri) {
        const info = await invoke<{ available: boolean; version: string; url: string; body: string }>('check_for_updates')
        setUpdateInfo(info)
        setUpdateStatus(info.available ? 'available' : 'uptodate')
      } else {
        setTimeout(() => setUpdateStatus('uptodate'), 1500)
      }
    } catch { setUpdateStatus('uptodate') }
  }

  const openUpdate = async () => {
    if (!updateInfo) return
    if (isTauri) await invoke('open_url', { url: updateInfo.url }).catch(console.error)
    else window.open(updateInfo.url, '_blank')
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
      {/* Nav */}
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

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto scrollbar-hide">

        {/* GENERAL */}
        {section === 'general' && (
          <div className="space-y-5">
            <SectionLabel icon={<Globe size={13} />} label={t('language')} />
            <div className="grid grid-cols-3 gap-1.5">
              {LANGS.map(l => (
                <button key={l.code} onClick={() => setLanguage(l.code)}
                  className={`px-2 py-2 rounded-lg text-xs font-body text-center transition-all flex items-center gap-1.5 justify-center ${
                    language === l.code ? 'bg-gold/15 text-gold border border-gold/25' : 'bg-white/[0.04] text-white/40 hover:text-white/70 border border-white/[0.05] hover:border-white/[0.1]'
                  }`}>
                  <span>{l.flag}</span>{l.label}
                </button>
              ))}
            </div>
            <div className="pt-2">
              <SectionLabel icon={<EyeOff size={13} />} label={t('nsfw')} />
              <ToggleRow icon={<EyeOff size={12} />} label={t('nsfw')} sub={t('nsfw_sub')} checked={nsfw} onChange={toggleNSFW} />
            </div>
          </div>
        )}

        {/* DISCORD */}
        {section === 'discord' && (
          <div className="space-y-4">
            <SectionLabel icon={<MessageSquare size={13} />} label="Discord Rich Presence" />
            <div className="p-3 rounded-xl bg-indigo-500/[0.08] border border-indigo-400/15 mb-2">
              <p className="text-xs text-indigo-300/70">Affiche ton activité ZAILON dans Discord.</p>
            </div>
            <ToggleRow icon={<MessageSquare size={12} />} label={t('discord_presence')} sub="Activer la présence Discord" checked={discordPresence} onChange={toggleDiscord} />
            {discordPresence && (
              <div className="space-y-2 pl-2 border-l-2 border-white/[0.06]">
                <ToggleRow icon={<Activity size={12} />} label={t('discord_launcher')} sub="Afficher quand le launcher est ouvert" checked={discordLauncher} onChange={() => setDiscordLauncher(!discordLauncher)} />
                <ToggleRow icon={<Activity size={12} />} label={t('discord_ingame')} sub="Afficher quand un jeu tourne" checked={discordIngame} onChange={() => setDiscordIngame(!discordIngame)} />
              </div>
            )}
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] mt-2">
              <p className="text-[10px] text-white/25 font-mono">La présence Discord en jeu sera disponible dans une prochaine mise à jour nécessitant la configuration du Discord App ID.</p>
            </div>
          </div>
        )}

        {/* UPDATES */}
        {section === 'updates' && (
          <div className="space-y-4">
            <SectionLabel icon={<RefreshCw size={13} />} label={t('updates')} />
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/40 font-mono">Version actuelle</p>
                <p className="font-display font-bold text-lg text-white">v1.0.0</p>
              </div>
              {updateStatus === 'uptodate' && (
                <div className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle size={13} />{t('up_to_date')}</div>
              )}
              {updateStatus === 'available' && updateInfo && (
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-xs text-gold mb-1"><AlertCircle size={13} />{t('update_available')} v{updateInfo.version}</div>
                </div>
              )}
            </div>
            <button onClick={checkUpdate} disabled={updateStatus === 'checking'}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-body font-medium border transition-all ${
                updateStatus === 'checking' ? 'text-white/30 border-white/[0.05] cursor-not-allowed' : 'text-white/80 border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07]'
              }`}>
              <RefreshCw size={12} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
              {updateStatus === 'checking' ? 'Vérification...' : t('check_updates')}
            </button>
            {updateStatus === 'available' && (
              <button onClick={openUpdate}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-display font-bold bg-gold text-ink-400 hover:bg-gold-bright transition-all">
                <Download size={12} /> {t('download_update')} <ExternalLink size={10} />
              </button>
            )}
            <div className="p-3 rounded-lg bg-gold/[0.04] border border-gold/10">
              <p className="text-[10px] text-gold/60 font-mono">Les mises à jour sont additives — tes mods, profils et temps de jeu ne sont jamais effacés.</p>
            </div>
          </div>
        )}

        {/* RESOURCES */}
        {section === 'resources' && (
          <div className="space-y-4">
            <SectionLabel icon={<Image size={13} />} label={t('resources')} />
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-xs text-white/50 leading-relaxed">Personnalise chaque jeu avec ton propre fond, icône ou vidéo. Les fonds peuvent aussi être chargés automatiquement depuis GitHub si disponibles.</p>
            </div>
            {games.map(game => (
              <div key={game.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.09] transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-white/80">{game.name}</p>
                  <button className="text-[10px] text-gold/50 hover:text-gold font-mono">Reset</button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[{ label: 'Fond', sub: '.jpg .png .mp4' }, { label: 'Icône', sub: '.png .ico' }, { label: 'Logo', sub: '.png .svg' }].map(({ label, sub }) => (
                    <button key={label} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-dashed border-white/[0.08] hover:border-gold/30 hover:bg-gold/[0.03] transition-all group">
                      <Image size={13} className="text-white/20 group-hover:text-gold/50 transition-colors" />
                      <span className="text-[10px] text-white/40 group-hover:text-white/70">{label}</span>
                      <span className="text-[9px] text-white/20 font-mono">{sub}</span>
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
            <SectionLabel icon={<BarChart2 size={13} />} label={t('stats')} />
            <div className="flex items-center justify-between p-3 rounded-xl bg-gold/[0.06] border border-gold/15">
              <div>
                <p className="text-[10px] text-gold/60 font-mono uppercase tracking-widest">{t('total_playtime')}</p>
                <p className="font-display font-bold text-2xl text-gold">{fmtTime(totalPlaytime)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/30">{games.length} jeux</p>
                <p className="text-xs text-white/30">{totalMods} mods</p>
              </div>
            </div>
            <div className="space-y-2">
              {[...games].sort((a, b) => b.playtime - a.playtime).map(game => {
                const pct = totalPlaytime > 0 ? (game.playtime / totalPlaytime) * 100 : 0
                return (
                  <div key={game.id} className="py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-white/70 truncate">{game.name}</span>
                      <span className="text-xs font-mono text-gold/70">{fmtTime(game.playtime)}</span>
                    </div>
                    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-gold/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {games.length === 0 && <p className="text-xs text-white/30 text-center py-4">Lance un jeu pour voir tes statistiques</p>}
            </div>
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
                <p className="text-xs text-gold/60 font-mono mt-0.5">v1.0.0 — Stable</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                ['Créé par', '@souanpt'],
                ['GitHub', 'Sankaiii/ZAILON'],
                ['Licence', 'Open Source'],
                ['Stack', 'React · TypeScript · Tauri'],
                ['Plateformes', 'Windows · Linux · macOS'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <span className="text-[10px] font-mono text-white/30">{k}</span>
                  <span className="text-xs text-white/60">{v}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-white/[0.05]">
              <p className="text-[10px] text-white/20 font-mono text-center">ZAILON n'est affilié à aucun studio ni plateforme.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex items-center gap-2 mb-3"><span className="text-gold/60">{icon}</span><span className="text-xs font-mono text-white/40 uppercase tracking-widest">{label}</span></div>
}

function ToggleRow({ icon, label, sub, checked, onChange }: { icon: React.ReactNode; label: string; sub: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <div className="flex items-center gap-2">
        <span className="text-white/40">{icon}</span>
        <div><p className="text-xs font-body text-white/70">{label}</p><p className="text-[10px] text-white/30">{sub}</p></div>
      </div>
      <Toggle checked={checked} onChange={onChange} size="sm" />
    </div>
  )
}
