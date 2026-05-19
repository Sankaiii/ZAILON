import { Globe, Activity, EyeOff, Info, BarChart2, MessageSquare } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Toggle } from '../UI/Toggle'
import { formatTime } from '../../utils'

const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
]

const SECTIONS = ['general', 'stats', 'about'] as const
type Section = typeof SECTIONS[number]

import { useState } from 'react'

export function SettingsView() {
  const { nsfw, toggleNSFW, language, setLanguage, discordPresence, toggleDiscord, games } = useStore()
  const [section, setSection] = useState<Section>('general')

  const totalPlaytime = games.reduce((acc, g) => acc + g.totalPlaytime, 0)

  return (
    <div className="flex h-full">
      {/* Settings nav */}
      <div className="w-32 border-r border-white/[0.05] py-3 flex flex-col gap-0.5 px-2 flex-shrink-0">
        {[
          { id: 'general', icon: Activity, label: 'General' },
          { id: 'stats', icon: BarChart2, label: 'Stats' },
          { id: 'about', icon: Info, label: 'About' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setSection(id as Section)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] font-body transition-all ${
              section === id
                ? 'bg-gold/12 text-gold border border-gold/20'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent'
            }`}>
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto scrollbar-hide">
        {section === 'general' && (
          <div className="space-y-5">
            {/* Language */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Globe size={12} className="text-gold/60" />
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Language</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {LANGS.map(l => (
                  <button key={l.code} onClick={() => setLanguage(l.code)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-body text-center transition-all ${
                      language === l.code
                        ? 'bg-gold/15 text-gold border border-gold/25'
                        : 'bg-white/[0.04] text-white/40 hover:text-white/70 border border-white/[0.05] hover:border-white/[0.1]'
                    }`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Activity size={12} className="text-gold/60" />
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Preferences</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={12} className="text-white/40" />
                    <div>
                      <p className="text-[10px] font-body text-white/70">Discord Presence</p>
                      <p className="text-[9px] text-white/30">Show ZAILON activity in Discord</p>
                    </div>
                  </div>
                  <Toggle checked={discordPresence} onChange={toggleDiscord} size="sm" />
                </div>

                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <EyeOff size={12} className="text-white/40" />
                    <div>
                      <p className="text-[10px] font-body text-white/70">NSFW Content</p>
                      <p className="text-[9px] text-white/30">Show adult mods in Explore</p>
                    </div>
                  </div>
                  <Toggle checked={nsfw} onChange={toggleNSFW} size="sm" />
                </div>
              </div>
            </div>
          </div>
        )}

        {section === 'stats' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={12} className="text-gold/60" />
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Play Stats</span>
              </div>

              {/* Global stat */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gold/[0.06] border border-gold/15 mb-3">
                <div>
                  <p className="text-[9px] text-gold/60 font-mono uppercase tracking-widest">Total Playtime</p>
                  <p className="font-display font-bold text-xl text-gold">{formatTime(totalPlaytime)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-white/30">{games.length} games</p>
                  <p className="text-[9px] text-white/30">{games.reduce((acc, g) => acc + g.profiles.reduce((a, p) => a + p.mods.length, 0), 0)} mods</p>
                </div>
              </div>

              {/* Per game */}
              <div className="space-y-1.5">
                {games.sort((a, b) => b.totalPlaytime - a.totalPlaytime).map(game => {
                  const pct = totalPlaytime > 0 ? (game.totalPlaytime / totalPlaytime) * 100 : 0
                  return (
                    <div key={game.id} className="py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-body text-white/70">{game.name}</span>
                        <span className="text-[10px] font-mono text-gold/70">{formatTime(game.totalPlaytime)}</span>
                      </div>
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-gold/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {section === 'about' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gold/[0.04] border border-gold/10">
              <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center flex-shrink-0">
                <span className="font-display font-black text-ink-400 text-lg">Z</span>
              </div>
              <div>
                <p className="font-display font-bold text-base text-white">ZAILON</p>
                <p className="text-[10px] text-white/40">Universal Mod Launcher</p>
                <p className="text-[10px] text-gold/60 font-mono mt-0.5">v1.0.0</p>
              </div>
            </div>

            <div className="space-y-2">
              <Row label="Author" value="@souanpt" />
              <Row label="GitHub" value="Sankaiii/Zailon" />
              <Row label="License" value="Open Source" />
              <Row label="Built with" value="React · TypeScript · Tauri" />
              <Row label="Platform" value="Windows · Linux · macOS" />
            </div>

            <div className="pt-2 border-t border-white/[0.05]">
              <p className="text-[9px] text-white/20 font-mono text-center">
                ZAILON is not affiliated with any game studio or mod platform.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
      <span className="text-[9px] font-mono text-white/30">{label}</span>
      <span className="text-[10px] font-body text-white/60">{value}</span>
    </div>
  )
}
